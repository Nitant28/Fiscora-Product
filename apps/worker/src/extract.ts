/**
 * Structured invoice extraction orchestrator.
 *
 * Pipeline (grounded, never trusts a single source blindly):
 *   1. Deterministic engine (regex/heuristics) — always runs, offline-safe.
 *   2. Gemini semantic engine — resolves which value is what, over OCR text only.
 *   3. Merge — LLM wins on semantics; the deterministic engine fills gaps and
 *      RECONCILES all monetary fields (a hallucinated total cannot silently win).
 *   4. Normalise (dates, currency, vendor) + per-field confidence & provenance.
 *
 * Output is backward-compatible with worker.ts and adds docType/dueDate/poNumber/
 * paymentTerms/taxId plus `confidence`, `provenance`, and `overallConfidence`.
 */
import { extractLineItems } from "./extraction/lineItems";
import {
  extractFinancialFields,
  mergeFinancialFields,
  parseMoney,
  type FinancialFields,
} from "./extraction/money";
import { extractWithGemini, isGeminiConfigured } from "./extraction/gemini";
import { runHeuristics } from "./extraction/heuristics";
import { cleanVendorName, detectCurrency, normalizeDate } from "./extraction/normalize";
import {
  ExtractedInvoice,
  ExtractionSource,
  MONEY_FIELDS,
  emptyInvoice,
} from "./extraction/schema";

export { extractLineItems } from "./extraction/lineItems";

// Values that are clearly OCR labels, never a real vendor.
const VENDOR_REJECT = /^(address|account|invoice|bill\s*to|ship\s*to|customer|date|total|subtotal|amount)\b/i;

type Choice = { value: string | null; source: ExtractionSource; conf: number };

function chooseString(ai: string | null, heur: string | null): Choice {
  const a = ai?.trim() || null;
  const h = heur?.trim() || null;

  if (a && h) {
    const agree = a.toLowerCase() === h.toLowerCase();
    return { value: a, source: agree ? "merged" : "gemini", conf: agree ? 0.95 : 0.8 };
  }
  if (a) return { value: a, source: "gemini", conf: 0.85 };
  if (h) return { value: h, source: "heuristic", conf: 0.7 };
  return { value: null, source: "none", conf: 0 };
}

function set(
  out: ExtractedInvoice,
  key: string,
  choice: Choice
): void {
  (out as any)[key] = choice.value;
  out.provenance[key] = choice.source;
  out.confidence[key] = choice.value == null ? 0 : choice.conf;
}

export async function extractInvoiceData(
  parsedText: string,
  filePath?: string
): Promise<ExtractedInvoice> {
  const heur = runHeuristics(parsedText);
  const regexFinancial: FinancialFields = extractFinancialFields(parsedText);

  let ai = null as Awaited<ReturnType<typeof extractWithGemini>>;
  if (isGeminiConfigured()) {
    console.log("🧠 Calling Gemini vision extraction engine...");
    ai = await extractWithGemini(parsedText, filePath);
  } else {
    console.log("ℹ️ GEMINI_API_KEY not set — using deterministic extraction engine.");
  }

  const out = emptyInvoice();
  out.source = ai ? "merged" : "heuristic";
  out.rawText = parsedText;

  // --- Semantic / text fields ---
  set(out, "vendorName", chooseString(ai?.vendorName ?? null, heur.vendorName));
  if (out.vendorName && VENDOR_REJECT.test(out.vendorName)) {
    set(out, "vendorName", { value: null, source: "none", conf: 0 });
  }
  out.vendorName = cleanVendorName(out.vendorName);

  set(out, "customerName", chooseString(ai?.customerName ?? null, heur.customerName));
  set(out, "invoiceNumber", chooseString(ai?.invoiceNumber ?? null, heur.invoiceNumber));
  set(out, "poNumber", chooseString(ai?.poNumber ?? null, heur.poNumber));
  set(out, "taxId", chooseString(ai?.taxId ?? null, heur.taxId));
  set(out, "paymentTerms", chooseString(ai?.paymentTerms ?? null, heur.paymentTerms));

  // --- Dates (normalise to ISO where possible) ---
  const invDate = chooseString(ai?.invoiceDate ?? null, heur.invoiceDate);
  invDate.value = invDate.value ? normalizeDate(invDate.value) ?? invDate.value : null;
  set(out, "invoiceDate", invDate);

  const dueDate = chooseString(ai?.dueDate ?? null, heur.dueDate);
  dueDate.value = dueDate.value ? normalizeDate(dueDate.value) ?? dueDate.value : null;
  set(out, "dueDate", dueDate);

  // --- Currency ---
  const currency =
    ai?.currency?.trim() || heur.currency || detectCurrency(parsedText) || null;
  set(out, "currency", {
    value: currency,
    source: ai?.currency ? "gemini" : heur.currency ? "heuristic" : "merged",
    conf: currency ? 0.8 : 0,
  });

  // --- Document type ---
  const docType = (ai?.docType as ExtractedInvoice["docType"]) || heur.docType;
  out.docType = docType || "unknown";
  out.provenance.docType = ai?.docType ? "gemini" : "heuristic";
  out.confidence.docType = out.docType === "unknown" ? 0.3 : 0.8;

  // --- Monetary fields: prefer LLM, then RECONCILE against regex totals ---
  const money: FinancialFields = {
    subtotal: ai?.subtotal ?? heur.subtotal,
    shipping: ai?.shipping ?? heur.shipping,
    tax: ai?.tax ?? heur.tax,
    discount: ai?.discount ?? heur.discount,
    balanceDue: ai?.balanceDue ?? heur.balanceDue,
    totalAmount: ai?.totalAmount ?? heur.totalAmount,
  };
  const reconciled = mergeFinancialFields(money, regexFinancial);

  for (const field of MONEY_FIELDS) {
    const value = parseMoney(reconciled[field]);
    const aiHad = ai?.[field] != null;
    const regexHad = regexFinancial[field] != null;
    const agree =
      aiHad && regexHad && Math.abs((ai![field] as number) - regexFinancial[field]!) < 0.5;
    (out as any)[field] = value;
    out.provenance[field] = value == null ? "none" : agree ? "merged" : aiHad ? "gemini" : "heuristic";
    out.confidence[field] = value == null ? 0 : agree ? 0.97 : aiHad || regexHad ? 0.75 : 0;
  }

  // Sanity: subtotal + tax + shipping - discount ≈ total boosts confidence.
  if (out.subtotal != null && out.totalAmount != null) {
    const computed =
      out.subtotal + (out.tax ?? 0) + (out.shipping ?? 0) - (out.discount ?? 0);
    if (Math.abs(computed - out.totalAmount) < 1) {
      out.confidence.totalAmount = Math.max(out.confidence.totalAmount, 0.98);
    }
  }

  // --- Line items: prefer the richer source ---
  const aiItems = ai?.lineItems?.filter((i) => i.description) ?? [];
  out.lineItems =
    aiItems.length >= heur.lineItems.length
      ? aiItems
      : heur.lineItems;
  out.provenance.lineItems = aiItems.length >= heur.lineItems.length && aiItems.length ? "gemini" : "heuristic";
  out.confidence.lineItems = out.lineItems.length ? 0.8 : 0;

  // Last-resort line items from raw text if both engines found none.
  if (!out.lineItems.length) {
    out.lineItems = extractLineItems(parsedText).map((li) => ({
      description: li.description,
      quantity: li.quantity,
      rate: li.rate,
      amount: li.amount,
    }));
  }

  // --- Overall confidence: weighted over the fields that matter most ---
  const weights: Record<string, number> = {
    vendorName: 0.25,
    invoiceNumber: 0.15,
    invoiceDate: 0.15,
    totalAmount: 0.3,
    currency: 0.05,
    lineItems: 0.1,
  };
  let acc = 0;
  let wsum = 0;
  for (const [k, w] of Object.entries(weights)) {
    acc += (out.confidence[k] ?? 0) * w;
    wsum += w;
  }
  out.overallConfidence = wsum ? Number((acc / wsum).toFixed(3)) : 0;

  return out;
}
