/**
 * Compares AI-extracted amounts to OCR text; emits extraction-error flags when misaligned.
 */
import {
  extractFinancialFields,
  extractMoney,
  parseMoney,
} from "./money";

/* --- TYPES --- */
export type ExtractionConfidence = {
  vendor: number;
  date: number;
  amounts: number;
  overall: number;
  requiresReview: boolean;
};

/* --- PER-FIELD OCR ALIGNMENT --- */
function scoreField(
  extracted: unknown,
  rawText: string,
  label: string
): number {
  const parsed = parseMoney(
    extracted
  );

  if (parsed == null) {
    return 0;
  }

  const fromText =
    extractMoney(rawText, label);

  if (fromText == null) {
    return parsed > 0 ? 75 : 0;
  }

  const diff = Math.abs(
    parsed - fromText
  );

  if (diff <= 0.01) {
    return 98;
  }

  if (diff <= 1) {
    return 90;
  }

  if (
    parsed < 10 &&
    fromText > 100
  ) {
    return 42;
  }

  const pctDiff =
    (diff / fromText) * 100;

  if (pctDiff > 50) {
    return 35;
  }

  if (pctDiff > 10) {
    return 60;
  }

  return 80;
}

/* --- EXTRACTION CONFIDENCE --- */
export function calculateExtractionConfidence(
  data: {
    vendorName?: string | null;
    invoiceDate?: string | null;
    subtotal?: unknown;
    shipping?: unknown;
    tax?: unknown;
    discount?: unknown;
    totalAmount?: unknown;
    balanceDue?: unknown;
  },
  rawText: string
): ExtractionConfidence {
  const vendor = data.vendorName
    ? 98
    : 0;

  const date = data.invoiceDate
    ? 96
    : 0;

  const financial =
    extractFinancialFields(
      rawText
    );

  const amountScores = [
    scoreField(
      data.subtotal ??
        financial.subtotal,
      rawText,
      "Subtotal"
    ),
    scoreField(
      data.totalAmount ??
        data.balanceDue ??
        financial.totalAmount,
      rawText,
      "Total"
    ),
    scoreField(
      data.shipping ??
        financial.shipping,
      rawText,
      "Shipping"
    ),
    scoreField(
      data.discount ??
        financial.discount,
      rawText,
      "Discount"
    ),
  ].filter((score) => score > 0);

  const amounts =
    amountScores.length > 0
      ? Math.round(
          amountScores.reduce(
            (sum, score) =>
              sum + score,
            0
          ) / amountScores.length
        )
      : 0;

  const overall = Math.round(
    (vendor + date + amounts) / 3
  );

  return {
    vendor,
    date,
    amounts,
    overall,
    requiresReview: overall < 75,
  };
}

/* --- EXTRACTION ERROR FLAGS --- */
export function detectExtractionErrors(
  data: {
    subtotal?: unknown;
    totalAmount?: unknown;
    balanceDue?: unknown;
  },
  rawText: string,
  confidence: ExtractionConfidence
) {
  const errors = [];

  if (confidence.amounts < 75) {
    errors.push({
      type: "EXTRACTION_ERROR",
      severity: "HIGH",
      message:
        "Amount parsing may be incorrect — OCR values do not match extracted amounts. Human review required.",
    });
  }

  if (confidence.overall < 75) {
    errors.push({
      type:
        "LOW_EXTRACTION_CONFIDENCE",
      severity: "MEDIUM",
      message: `Extraction confidence ${confidence.overall}% is below review threshold (75%)`,
    });
  }

  const financial =
    extractFinancialFields(
      rawText
    );

  const extractedTotal =
    parseMoney(
      data.balanceDue
    ) ??
    parseMoney(
      data.totalAmount
    );

  if (
    financial.totalAmount &&
    extractedTotal &&
    extractedTotal < 10 &&
    financial.totalAmount > 100
  ) {
    errors.push({
      type: "EXTRACTION_ERROR",
      severity: "HIGH",
      message: `Amount parsing failed: extracted $${extractedTotal.toFixed(2)} but OCR shows $${financial.totalAmount.toFixed(2)}`,
    });
  }

  return errors;
}
