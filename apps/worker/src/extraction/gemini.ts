/**
 * Grounded multimodal LLM extraction via Google Gemini.
 *
 * Gemini is the *vision/semantic* evidence source in the multi-model pipeline. It
 * receives BOTH the document image (so it can read handwriting, stamps, and print
 * that a text OCR engine misses) AND the noisy OCR text as a hint. It is
 * instructed to read strictly what is visible and return null rather than invent.
 * All amounts are still reconciled against the deterministic engine downstream, so
 * a hallucinated value cannot silently win.
 *
 * Resilience: retries with backoff and falls back across models on 429/5xx. If it
 * ultimately can't run (no key, quota exhausted, offline), it returns null and the
 * deterministic engine carries — extraction never hard-depends on the network.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

for (const rel of ["../../.env", "../.env", ".env"]) {
  dotenv.config({ path: path.resolve(process.cwd(), rel), override: false });
}

// Current multimodal models first; each is tried once and we advance on
// 429/404/5xx so an exhausted-quota or renamed model never blocks extraction.
const MODELS = Array.from(
  new Set(
    [
      "gemini-2.5-flash",
      "gemini-flash-latest",
      "gemini-2.5-flash-lite",
      process.env.GEMINI_MODEL,
      "gemini-2.0-flash",
    ].filter(Boolean) as string[]
  )
);
const TIMEOUT_MS = 35_000;

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/png",
  ".bmp": "image/png",
  ".pdf": "application/pdf",
};

export type GeminiExtraction = {
  docType: string | null;
  vendorName: string | null;
  customerName: string | null;
  invoiceNumber: string | null;
  poNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string | null;
  taxId: string | null;
  paymentTerms: string | null;
  subtotal: number | null;
  shipping: number | null;
  tax: number | null;
  discount: number | null;
  balanceDue: number | null;
  totalAmount: number | null;
  lineItems: Array<{
    description: string;
    quantity: number | null;
    rate: number | null;
    amount: number | null;
  }>;
};

const SYSTEM_INSTRUCTION = `You are an enterprise document-understanding engine for a procurement platform (invoices, receipts, purchase orders, utility bills, credit notes).

You are given the DOCUMENT IMAGE and (optionally) a noisy OCR text extract. READ THE IMAGE DIRECTLY — including handwriting, stamps, and printed text the OCR may have missed. Treat the OCR text only as a hint.

Rules:
- Extract fields STRICTLY from what is visible in the document. If a field is not present, return null. NEVER guess, infer from world knowledge, or invent values.
- "vendorName" is the SELLER / merchant / company that ISSUED the document (often the letterhead/logo). It is never a generic label like "ADDRESS" or the buyer. If unclear, null.
- "customerName" is the bill-to / recipient (e.g. handwritten "Mr Joe Werthan").
- Monetary fields must be plain numbers (no symbols, no thousands separators). "totalAmount" is the final payable amount (prefer Balance Due / Amount Due / the summed total).
- Dates: ISO yyyy-mm-dd when unambiguous, else the literal text (e.g. "May 1, 1943" -> 1943-05-01).
- Correct obvious OCR/handwriting digit confusions only in clearly-numeric contexts.
- Detect docType: invoice, receipt, purchase_order, utility_bill, quotation, credit_note, unknown.
- Read every line item you can, including handwritten rows; use null for missing numeric cells.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    docType: { type: "STRING", nullable: true },
    vendorName: { type: "STRING", nullable: true },
    customerName: { type: "STRING", nullable: true },
    invoiceNumber: { type: "STRING", nullable: true },
    poNumber: { type: "STRING", nullable: true },
    invoiceDate: { type: "STRING", nullable: true },
    dueDate: { type: "STRING", nullable: true },
    currency: { type: "STRING", nullable: true },
    taxId: { type: "STRING", nullable: true },
    paymentTerms: { type: "STRING", nullable: true },
    subtotal: { type: "NUMBER", nullable: true },
    shipping: { type: "NUMBER", nullable: true },
    tax: { type: "NUMBER", nullable: true },
    discount: { type: "NUMBER", nullable: true },
    balanceDue: { type: "NUMBER", nullable: true },
    totalAmount: { type: "NUMBER", nullable: true },
    lineItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          quantity: { type: "NUMBER", nullable: true },
          rate: { type: "NUMBER", nullable: true },
          amount: { type: "NUMBER", nullable: true },
        },
        required: ["description"],
      },
    },
  },
  required: ["docType"],
};

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function imagePart(filePath?: string): Record<string, unknown> | null {
  if (!filePath) return null;
  const ext = path.extname(filePath).toLowerCase();
  const mime = IMAGE_MIME[ext];
  if (!mime) return null;
  try {
    const data = fs.readFileSync(filePath).toString("base64");
    return { inlineData: { mimeType: mime, data } };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function extractWithGemini(
  ocrText: string,
  filePath?: string
): Promise<GeminiExtraction | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const img = imagePart(filePath);
  const parts: Record<string, unknown>[] = [
    {
      text: img
        ? `OCR hint (may be incomplete/noisy):\n${ocrText || "(none)"}\n\nRead the attached document image and extract the fields.`
        : ocrText || "(no text)",
    },
  ];
  if (img) parts.push(img);

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body,
      });

      // Auth failures are terminal — retrying other models won't help.
      if (res.status === 401 || res.status === 403) {
        console.log(`⚠️ Gemini auth error HTTP ${res.status} — check GEMINI_API_KEY.`);
        return null;
      }

      // Quota / not-found / bad-request / server errors → try the next model.
      if (!res.ok) {
        console.log(`⚠️ Gemini ${model} HTTP ${res.status} — trying next model.`);
        if (res.status === 429) await sleep(1500);
        continue;
      }

      const data: any = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      const parsed = JSON.parse(text) as Partial<GeminiExtraction>;
      console.log(`✅ Gemini vision extraction via ${model}`);
      return {
        docType: parsed.docType ?? null,
        vendorName: parsed.vendorName ?? null,
        customerName: parsed.customerName ?? null,
        invoiceNumber: parsed.invoiceNumber ?? null,
        poNumber: parsed.poNumber ?? null,
        invoiceDate: parsed.invoiceDate ?? null,
        dueDate: parsed.dueDate ?? null,
        currency: parsed.currency ?? null,
        taxId: parsed.taxId ?? null,
        paymentTerms: parsed.paymentTerms ?? null,
        subtotal: parsed.subtotal ?? null,
        shipping: parsed.shipping ?? null,
        tax: parsed.tax ?? null,
        discount: parsed.discount ?? null,
        balanceDue: parsed.balanceDue ?? null,
        totalAmount: parsed.totalAmount ?? null,
        lineItems: Array.isArray(parsed.lineItems)
          ? parsed.lineItems.map((li) => ({
              description: String(li.description ?? "").trim(),
              quantity: li.quantity ?? null,
              rate: li.rate ?? null,
              amount: li.amount ?? null,
            }))
          : [],
      };
    } catch (err) {
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? "timeout"
          : err instanceof Error
            ? err.message
            : "unknown error";
      console.log(`⚠️ Gemini ${model} error (${reason}) — trying next model.`);
      await sleep(1000);
    } finally {
      clearTimeout(timeout);
    }
  }

  console.log("⚠️ Gemini unavailable after retries — using deterministic engine.");
  return null;
}
