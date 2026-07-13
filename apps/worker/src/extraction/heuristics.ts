/**
 * Deterministic invoice extraction from OCR text.
 *
 * This is the always-available engine: it runs with zero external dependencies
 * and serves as (a) the fallback when the LLM is unavailable and (b) a corrector
 * that fills gaps and reconciles LLM amounts against regex-found totals. It is
 * intentionally conservative — it returns null rather than guessing, because a
 * wrong vendor ("ADDRESS") is worse than an empty field.
 */
import { extractFinancialFields } from "./money";
import { extractLineItems } from "./lineItems";
import { cleanVendorName, DATE_RE, detectCurrency, normalizeDate } from "./normalize";
import { DocType, ExtractedInvoice, emptyInvoice } from "./schema";

const COMPANY_SUFFIX =
  /\b(inc|incorporated|ltd|limited|llc|llp|pvt|private|corp|corporation|co|company|gmbh|traders?|enterprises?|industries|solutions?|services?|systems?|technologies|pharma|foods?|candies|works|associates|&\s*co)\b/i;

// Lines that are field labels / section headers, never a vendor name.
const NOISE_LABEL =
  /^(address|invoice|bill\s*to|ship\s*to|sold\s*to|account\s*(number|holder|no)|service\s*(address|type)|bill\s*date|due\s*date|rate\s*code|meter|usage\s*summary|charges?\s*detail|statement|tax\s*invoice|gst\s*invoice|receipt|purchase\s*order|date|invoice\s*(number|date)|customer|to|from|description|qty|quantity|amount|total|subtotal|previous\s*(reading|balance)|current\s*reading|payment\s*received)\b/i;

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isFieldLabelLine(line: string): boolean {
  // "Something: value" where the label is a known noise label.
  const label = line.split(":")[0]?.trim() ?? "";
  return line.includes(":") && NOISE_LABEL.test(label);
}

export function extractVendor(text: string): string | null {
  const ls = lines(text).slice(0, 15);

  // 1) Strongest signal: a line carrying a company suffix.
  for (const line of ls) {
    if (COMPANY_SUFFIX.test(line) && !isFieldLabelLine(line) && line.length <= 60) {
      return cleanVendorName(line);
    }
  }

  // 2) Otherwise the first "name-like" line near the top: alphabetic, short,
  //    title-cased, and free of the noise that marks addresses/tables/units.
  for (const line of ls) {
    if (NOISE_LABEL.test(line) || isFieldLabelLine(line)) continue;
    if (/[()\d@$₹£€]|www\.|http/i.test(line)) continue;
    const words = line.split(" ");
    if (words.length > 6 || words.length < 1) continue;
    if (!/^[A-Z]/.test(line)) continue;
    const capWords = words.filter((w) => /^[A-Z]/.test(w)).length;
    if (capWords >= 1) return cleanVendorName(line);
  }

  return null;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const val = m[1].trim();
      if (val && !/^(no|number|#|date)$/i.test(val)) return val;
    }
  }
  return null;
}

export function extractInvoiceNumber(text: string): string | null {
  return firstMatch(text, [
    /invoice\s*(?:no|number|num|#)?\s*[:.#\-]?\s*([A-Za-z0-9][A-Za-z0-9\/\-]{2,})/i,
    /\b(?:inv|bill|ref|order)\s*(?:no|number|#)?\s*[:.#\-]?\s*([A-Za-z0-9][A-Za-z0-9\/\-]{2,})/i,
    /#\s*([A-Za-z0-9\-\/]{3,})/,
  ]);
}

export function extractPoNumber(text: string): string | null {
  return firstMatch(text, [
    /\b(?:p\.?o\.?|purchase\s*order)\s*(?:no|number|#)?\s*[:.#\-]?\s*([A-Za-z0-9][A-Za-z0-9\/\-]{2,})/i,
  ]);
}

function dateForLabels(text: string, labels: string): string | null {
  const re = new RegExp(
    `(?:${labels})\\s*[:.\\-]?\\s*${DATE_RE.source}`,
    "i"
  );
  const m = text.match(re);
  if (!m?.[1]) return null;
  return normalizeDate(m[1]) ?? m[1];
}

export function extractInvoiceDate(text: string): string | null {
  return (
    dateForLabels(text, "invoice\\s*date|bill\\s*date|date\\s*of\\s*issue|dated|statement\\s*date") ??
    dateForLabels(text, "date")
  );
}

export function extractDueDate(text: string): string | null {
  return dateForLabels(text, "due\\s*date|payment\\s*due|due\\s*by|pay\\s*by");
}

export function extractCustomer(text: string): string | null {
  const m = text.match(
    /(?:bill\s*to|sold\s*to|customer|account\s*holder)\s*[:.\-]?\s*([^\t\r\n]+)/i
  );
  return m?.[1] ? cleanVendorName(m[1]) : null;
}

export function extractPaymentTerms(text: string): string | null {
  const m = text.match(
    /\b(net\s*\d{1,3}|due\s*on\s*receipt|payable\s*on\s*receipt|c\.?o\.?d\.?|advance|\d{1,3}\s*days)\b/i
  );
  return m?.[1] ? m[1].replace(/\s+/g, " ").trim() : null;
}

export function extractTaxId(text: string): string | null {
  // Indian GSTIN; extendable to VAT/EIN later.
  const m = text.match(/\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]Z[A-Z\d])\b/);
  return m?.[1] ?? null;
}

export function detectDocType(text: string): DocType {
  const t = text.toLowerCase();
  if (/purchase\s*order|\bp\.?o\.?\s*(no|number|#)/.test(t)) return "purchase_order";
  if (/quotation|quote\s*no|proforma/.test(t)) return "quotation";
  if (/credit\s*note/.test(t)) return "credit_note";
  if (/utility|electric|\bgas\b|kwh|therms|meter\s*#|rate\s*code/.test(t)) return "utility_bill";
  if (/receipt|luncheon|confections/.test(t)) return "receipt";
  if (/invoice|bill\s*to|tax\s*invoice/.test(t)) return "invoice";
  return "unknown";
}

/** Run the full deterministic engine over OCR text. */
export function runHeuristics(text: string): ExtractedInvoice {
  const out = emptyInvoice();
  const fin = extractFinancialFields(text);

  out.docType = detectDocType(text);
  out.vendorName = extractVendor(text);
  out.customerName = extractCustomer(text);
  out.invoiceNumber = extractInvoiceNumber(text);
  out.poNumber = extractPoNumber(text);
  out.invoiceDate = extractInvoiceDate(text);
  out.dueDate = extractDueDate(text);
  out.currency = detectCurrency(text);
  out.taxId = extractTaxId(text);
  out.paymentTerms = extractPaymentTerms(text);

  out.subtotal = fin.subtotal;
  out.shipping = fin.shipping;
  out.tax = fin.tax;
  out.discount = fin.discount;
  out.balanceDue = fin.balanceDue;
  out.totalAmount = fin.totalAmount;

  out.lineItems = extractLineItems(text).map((li) => ({
    description: li.description,
    quantity: li.quantity,
    rate: li.rate,
    amount: li.amount,
  }));

  out.source = "heuristic";
  return out;
}
