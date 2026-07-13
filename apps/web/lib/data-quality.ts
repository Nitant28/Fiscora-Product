export type QualityBand = "GREEN" | "YELLOW" | "RED";

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

export function hasDataQuality(
  scores: {
    dataQualityScore?: number | null;
    extractionConfidence?: number | null;
  } | null
): boolean {
  if (!scores) {
    return false;
  }

  return (
    (scores.dataQualityScore ?? 0) > 0 ||
    (scores.extractionConfidence ?? 0) > 0
  );
}
