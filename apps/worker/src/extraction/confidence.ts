/**
 * Document-level confidence score (0–100) from required fields and business-flag penalty.
 */

/* --- CONFIDENCE SCORING --- */
export function calculateConfidence(
  data: {
    vendorName?: string | null;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    totalAmount?: number | null;
  },

  flagCount: number
) {
  let score = 100;

  if (!data.vendorName)
    score -= 20;

  if (!data.invoiceNumber)
    score -= 20;

  if (!data.invoiceDate)
    score -= 10;

  if (!data.totalAmount)
    score -= 30;

  score -= flagCount * 10;

  return Math.max(score, 0);
}