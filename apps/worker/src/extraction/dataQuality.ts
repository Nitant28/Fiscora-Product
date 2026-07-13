/**
 * Aggregates extraction, financial, line-item, and vendor scores into review-ready metrics.
 */
import type { ExtractionConfidence } from "./extractionQuality";

/* --- TYPES --- */
export type DataQualityScores = {
  extractionConfidence: number;
  financialConfidence: number;
  lineItemConfidence: number;
  vendorConfidence: number;
  dataQualityScore: number;
  requiresReview: boolean;
};

export type QualityBand = "GREEN" | "YELLOW" | "RED";

/* --- QUALITY BANDS --- */
export function getQualityBand(
  score: number
): QualityBand {
  if (score >= 90) {
    return "GREEN";
  }

  if (score >= 75) {
    return "YELLOW";
  }

  return "RED";
}

/* --- LINE ITEM COMPLETENESS --- */
export function computeLineItemConfidence(
  lineItems: Array<{
    rate?: number | null;
    amount?: number | null;
    description?: string;
  }>
): number {
  if (!lineItems.length) {
    return 0;
  }

  const withRate = lineItems.filter(
    (item) =>
      item.rate != null && item.rate > 0
  ).length;

  const withAmount = lineItems.filter(
    (item) =>
      item.amount != null &&
      item.amount > 0
  ).length;

  const withDescription = lineItems.filter(
    (item) =>
      item.description &&
      item.description.trim().length > 2
  ).length;

  const rateScore =
    (withRate / lineItems.length) * 100;

  const amountScore =
    (withAmount / lineItems.length) *
    100;

  const descScore =
    (withDescription /
      lineItems.length) *
    100;

  return Math.round(
    (rateScore + amountScore + descScore) /
      3
  );
}

/* --- COMPOSITE SCORES --- */
export function buildDataQualityScores(
  extraction: ExtractionConfidence,
  lineItems: Array<{
    rate?: number | null;
    amount?: number | null;
    description?: string;
  }>
): DataQualityScores {
  const financialConfidence =
    extraction.amounts;

  const vendorConfidence =
    extraction.vendor;

  const lineItemConfidence =
    computeLineItemConfidence(
      lineItems
    );

  const extractionConfidence =
    extraction.overall;

  const components = [
    extractionConfidence,
    financialConfidence,
    lineItemConfidence,
    vendorConfidence,
  ].filter((score) => score > 0);

  const dataQualityScore =
    components.length > 0
      ? Math.round(
          components.reduce(
            (sum, score) =>
              sum + score,
            0
          ) / components.length
        )
      : 0;

  const requiresReview =
    extraction.requiresReview ||
    dataQualityScore < 75 ||
    financialConfidence < 75 ||
    lineItemConfidence < 75 ||
    vendorConfidence < 75;

  return {
    extractionConfidence,
    financialConfidence,
    lineItemConfidence,
    vendorConfidence,
    dataQualityScore,
    requiresReview,
  };
}
