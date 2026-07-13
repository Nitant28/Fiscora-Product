/**
 * Client for the Fiscora AI platform (apps/ai).
 *
 * The worker holds NO AI logic — it uploads the document to the platform's
 * `/v1/extract` endpoint, which runs the full pipeline (Document → Enhance → OCR
 * → Graph → Extraction → Vision → Validation → Confidence Fusion) and returns a
 * structured document with per-field confidence and provenance. This is the
 * single seam that keeps the worker and the AI models one system.
 *
 * Returns null when the service is unreachable so the worker can fall back to its
 * local extraction path (no hard dependency, no regression).
 */
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

type PlatformField = { value: unknown; confidence?: number };
type PlatformResult = {
  document_type?: string;
  overall_confidence?: number;
  confidence?: number;
  currency?: string;
  raw_text?: string;
  vision_model?: string | null;
  fields?: Record<string, PlatformField>;
  line_items?: Array<{
    description: string;
    quantity?: number | null;
    rate?: number | null;
    amount?: number | null;
  }>;
  validation?: unknown[];
};

function num(f?: PlatformField): number | null {
  return f && typeof f.value === "number" ? f.value : null;
}
function str(f?: PlatformField): string | null {
  return f && f.value != null && f.value !== "" ? String(f.value) : null;
}

function mapPlatformResult(res: PlatformResult) {
  const F = res.fields ?? {};
  const confidence: Record<string, number> = {};
  const provenance: Record<string, string> = {};
  for (const [k, v] of Object.entries(F)) {
    if (typeof v?.confidence === "number") confidence[k] = v.confidence;
  }

  return {
    docType: res.document_type ?? "unknown",
    vendorName: str(F.vendor_name),
    invoiceNumber: str(F.invoice_number),
    invoiceDate: str(F.invoice_date),
    dueDate: str(F.due_date),
    customerName: str(F.customer_name),
    poNumber: str(F.po_number),
    taxId: str(F.tax_id),
    paymentTerms: str(F.payment_terms),
    currency: str(F.currency) ?? res.currency ?? null,
    subtotal: num(F.subtotal),
    shipping: num(F.shipping),
    tax: num(F.tax),
    discount: num(F.discount),
    balanceDue: null as number | null,
    totalAmount: num(F.total),
    lineItems: (res.line_items ?? []).map((li) => ({
      description: li.description,
      quantity: li.quantity ?? undefined,
      rate: li.rate ?? undefined,
      amount: li.amount ?? undefined,
    })),
    confidence,
    provenance,
    overallConfidence: res.overall_confidence ?? res.confidence ?? 0,
    visionModel: res.vision_model ?? null,
    source: "platform" as const,
    rawText: res.raw_text ?? "",
  };
}

export type PlatformExtraction = ReturnType<typeof mapPlatformResult>;

export async function extractViaPlatform(
  filePath: string
): Promise<PlatformExtraction | null> {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), path.basename(filePath));

    const res = await axios.post<PlatformResult>(
      `${AI_SERVICE_URL}/v1/extract`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 120_000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    return mapPlatformResult(res.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.log(`ℹ️ AI platform /v1/extract unavailable (${msg}) — local fallback.`);
    return null;
  }
}
