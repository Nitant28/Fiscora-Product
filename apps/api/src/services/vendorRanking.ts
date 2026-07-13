/**
 * Domain: RFQ sourcing — normalize bid dimensions and compute weighted vendor rank scores.
 * Main exports: normalizePrice, normalizeDelivery, normalizeWarranty, calculateVendorRank, roundRankScore.
 * Called by: rfq.service.ts, recommendationEngine.ts.
 */

/* --- NORMALIZATION --- */

/** Lower value is better (price, delivery days). */
export function normalizePrice(
  value: number,
  min: number,
  max: number
) {
  if (min === max) {
    return 100;
  }

  return ((max - value) / (max - min)) * 100;
}

/** Lower delivery days is better — same math as price. */
export function normalizeDelivery(
  value: number,
  min: number,
  max: number
) {
  return normalizePrice(value, min, max);
}

/** Higher warranty months is better. */
export function normalizeWarranty(
  value: number,
  min: number,
  max: number
) {
  if (min === max) {
    return 100;
  }

  return ((value - min) / (max - min)) * 100;
}

/* --- RANKING --- */

export function calculateVendorRank(
  price: number,
  delivery: number,
  vendor: number,
  warranty: number
) {
  return (
    price * 0.4 +
    delivery * 0.3 +
    vendor * 0.2 +
    warranty * 0.1
  );
}

export function roundRankScore(score: number) {
  return Math.round(score * 10) / 10;
}
