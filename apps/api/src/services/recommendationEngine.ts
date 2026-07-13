/**
 * Domain: RFQ intelligence — bid ranking with human-readable explanations for award decisions.
 * Main exports: buildExplanation, generateRecommendation, rankBidsWithExplanation (and RFQRecommendation type).
 * Called by: modules/rfq/rfq.service.ts.
 */
import { computeProcurementScore } from "./procurementScoring";
import {
  calculateVendorRank,
  normalizeDelivery,
  normalizePrice,
  normalizeWarranty,
  roundRankScore,
} from "./vendorRanking";

export type RFQRecommendation = {
  vendorId: number;
  vendorName: string;
  score: number;
  rank: number;
  priceScore: number;
  deliveryScore: number;
  vendorScore: number;
  warrantyScore: number;
  explanation: string;
};

export function buildExplanation(
  priceScore: number,
  deliveryScore: number,
  vendorScore: number,
  warrantyScore: number
) {
  const reasons: string[] = [];

  if (deliveryScore > 90) {
    reasons.push("Fastest delivery");
  }

  if (vendorScore > 80) {
    reasons.push("Strong historical performance");
  }

  if (priceScore > 80) {
    reasons.push("Competitive pricing");
  }

  if (warrantyScore > 80) {
    reasons.push("Extended warranty coverage");
  }

  if (reasons.length === 0) {
    return "Best overall balance across price, delivery, vendor performance, and warranty.";
  }

  if (reasons.length === 1) {
    return `${reasons[0]}.`;
  }

  if (reasons.length === 2) {
    return `${reasons[0]} and ${reasons[1]!.toLowerCase()}.`;
  }

  const last = reasons.pop()!;
  return `${reasons.join(", ")} and ${last.toLowerCase()}.`;
}

export function generateRecommendation(input: {
  vendorId: number;
  vendorName: string;
  score: number;
  rank: number;
  priceScore: number;
  deliveryScore: number;
  vendorScore: number;
  warrantyScore: number;
}): RFQRecommendation {
  return {
    ...input,
    explanation: buildExplanation(
      input.priceScore,
      input.deliveryScore,
      input.vendorScore,
      input.warrantyScore
    ),
  };
}

type BidWithVendor = {
  vendorId: number;
  quotedAmount: number;
  leadTimeDays: number;
  warrantyMonths: number;
  vendor: {
    id: number;
    name: string;
    procurementScore: number | null;
    deliveryScore: number;
    invoiceAccuracyScore: number;
    priceCompetitivenessScore: number;
    reliabilityScore: number;
  };
};

/* --- BID RANKING --- */

export function rankBidsWithExplanation(
  bids: BidWithVendor[]
): RFQRecommendation[] {
  if (bids.length === 0) {
    return [];
  }

  const prices = bids.map((b) => b.quotedAmount);
  const deliveries = bids.map((b) => b.leadTimeDays);
  const warranties = bids.map((b) => b.warrantyMonths);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDelivery = Math.min(...deliveries);
  const maxDelivery = Math.max(...deliveries);
  const minWarranty = Math.min(...warranties);
  const maxWarranty = Math.max(...warranties);

  const ranked = bids
    .map((bid) => {
      const priceScore = Math.round(
        normalizePrice(
          bid.quotedAmount,
          minPrice,
          maxPrice
        )
      );
      const deliveryScore = Math.round(
        normalizeDelivery(
          bid.leadTimeDays,
          minDelivery,
          maxDelivery
        )
      );
      const warrantyScore = Math.round(
        normalizeWarranty(
          bid.warrantyMonths,
          minWarranty,
          maxWarranty
        )
      );
      const vendorScore = Math.round(
        bid.vendor.procurementScore ??
          computeProcurementScore(bid.vendor)
      );
      const score = roundRankScore(
        calculateVendorRank(
          priceScore,
          deliveryScore,
          vendorScore,
          warrantyScore
        )
      );

      return generateRecommendation({
        vendorId: bid.vendorId,
        vendorName: bid.vendor.name,
        score,
        rank: 0,
        priceScore,
        deliveryScore,
        vendorScore,
        warrantyScore,
      });
    })
    .sort((a, b) => b.score - a.score);

  return ranked.map((rec, index) => ({
    ...rec,
    rank: index + 1,
  }));
}
