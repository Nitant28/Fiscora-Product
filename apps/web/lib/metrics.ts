/**
 * Display helpers for dashboards and executive views.
 * Normalizes missing/invalid API numbers to a single "no data" label
 * and formats currency, scores, and counts for consistent UI copy.
 */

// ---------------------------------------------------------------------------
// Shared fallback label
// ---------------------------------------------------------------------------

export const NO_DATA =
  "Not enough data yet";

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isValidNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

// ---------------------------------------------------------------------------
// Currency (USD and INR, including Indian compact notation)
// ---------------------------------------------------------------------------

export function formatMoney(
  value: number | null | undefined
): string {
  if (!isValidNumber(value)) {
    return NO_DATA;
  }

  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatINR(
  value: number | null | undefined
): string {
  if (!isValidNumber(value)) {
    return NO_DATA;
  }

  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatINRCompact(
  value: number | null | undefined
): string {
  if (!isValidNumber(value)) {
    return NO_DATA;
  }

  // Crores (≥1 Cr) and lakhs (≥1 L) before full INR formatting
  if (value >= 10000000) {
    const cr = value / 10000000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }

  if (value >= 100000) {
    const lakhs = value / 100000;
    return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)}L`;
  }

  return formatINR(value);
}

// ---------------------------------------------------------------------------
// Scores, percentages, counts, and text
// ---------------------------------------------------------------------------

export function formatScore(
  value: number | null | undefined,
  max = 100
): string {
  if (
    !isValidNumber(value) ||
    value <= 0
  ) {
    return NO_DATA;
  }

  return `${Math.round(value)}/${max}`;
}

export function formatPercent(
  value: number | null | undefined
): string {
  if (!isValidNumber(value)) {
    return NO_DATA;
  }

  return `${Math.round(value)}%`;
}

export function formatCount(
  value: number | null | undefined
): string {
  if (!isValidNumber(value)) {
    return NO_DATA;
  }

  return String(Math.round(value));
}

export function formatText(
  value: string | null | undefined,
  emptyLabel = NO_DATA
): string {
  if (
    !value ||
    value.trim().length === 0
  ) {
    return emptyLabel;
  }

  return value;
}

// ---------------------------------------------------------------------------
// Presence checks (whether to show a metric vs. empty state)
// ---------------------------------------------------------------------------

export function hasMoney(
  value: number | null | undefined
): boolean {
  return (
    isValidNumber(value) && value > 0
  );
}

export function hasScore(
  value: number | null | undefined
): boolean {
  return (
    isValidNumber(value) && value > 0
  );
}
