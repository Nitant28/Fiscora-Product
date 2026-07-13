/**
 * Shared types for the invoice extraction engine.
 *
 * Every field the pipeline produces carries a value plus per-field provenance
 * (which source produced it) and confidence, so the UI/human-review can show
 * *why* a value is trusted — the enterprise "evidence" requirement.
 */

export type ExtractionSource = "gemini" | "heuristic" | "merged" | "none";

export type DocType =
  | "invoice"
  | "receipt"
  | "purchase_order"
  | "utility_bill"
  | "quotation"
  | "credit_note"
  | "unknown";

export type LineItem = {
  description: string;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
};

/** The canonical extracted document. Superset of what the worker persists. */
export type ExtractedInvoice = {
  docType: DocType;

  vendorName: string | null;
  customerName: string | null;
  invoiceNumber: string | null;
  poNumber: string | null;

  invoiceDate: string | null;
  dueDate: string | null;

  currency: string | null;
  taxId: string | null; // GSTIN / VAT / tax registration
  paymentTerms: string | null;

  subtotal: number | null;
  shipping: number | null;
  tax: number | null;
  discount: number | null;
  balanceDue: number | null;
  totalAmount: number | null;

  lineItems: LineItem[];

  /** 0..1 per field. */
  confidence: Record<string, number>;
  /** which engine produced each field. */
  provenance: Record<string, ExtractionSource>;
  overallConfidence: number;
  source: ExtractionSource;

  rawText?: string;
};

export const MONEY_FIELDS = [
  "subtotal",
  "shipping",
  "tax",
  "discount",
  "balanceDue",
  "totalAmount",
] as const;

export function emptyInvoice(): ExtractedInvoice {
  return {
    docType: "unknown",
    vendorName: null,
    customerName: null,
    invoiceNumber: null,
    poNumber: null,
    invoiceDate: null,
    dueDate: null,
    currency: null,
    taxId: null,
    paymentTerms: null,
    subtotal: null,
    shipping: null,
    tax: null,
    discount: null,
    balanceDue: null,
    totalAmount: null,
    lineItems: [],
    confidence: {},
    provenance: {},
    overallConfidence: 0,
    source: "none",
  };
}
