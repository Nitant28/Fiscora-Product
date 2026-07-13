export const COLLECTING_VENDOR_HISTORY =
  "Collecting vendor history";

export const MIN_VENDOR_INVOICES = 3;

export type VendorMetricKey =
  | "vendorScore"
  | "pricingScore"
  | "reliabilityScore"
  | "accuracyScore"
  | "potentialAnnualSavings"
  | "vendorRanking";

export type VendorMetricMeta = {
  label: string;
  sourceTable: string;
  formula: string;
  apiField: string;
  component: string;
};

export const VENDOR_METRIC_META: Record<
  VendorMetricKey,
  VendorMetricMeta
> = {
  vendorScore: {
    label: "Vendor Score",
    sourceTable: "Vendor",
    formula:
      "(pricingScore + reliabilityScore + accuracyScore) ÷ 3",
    apiField: "vendor.vendorScore",
    component: "VendorIntelligence",
  },
  pricingScore: {
    label: "Pricing Score",
    sourceTable: "Vendor + LineItem",
    formula:
      "75 + avg((marketRate − vendorRate) / marketRate × 100)",
    apiField: "vendor.pricingScore",
    component: "VendorIntelligence",
  },
  reliabilityScore: {
    label: "Reliability Score",
    sourceTable: "Vendor + InvoiceFlag",
    formula:
      "70 + min(invoices×3, 20) − highFlags×8 − duplicateFlags×15",
    apiField: "vendor.reliabilityScore",
    component: "VendorIntelligence",
  },
  accuracyScore: {
    label: "Accuracy Score",
    sourceTable: "Document",
    formula:
      "avg(confidenceScore) − (missingFields/invoices)×20",
    apiField: "vendor.accuracyScore",
    component: "VendorIntelligence",
  },
  potentialAnnualSavings: {
    label: "Potential Annual Savings",
    sourceTable: "ProcurementInsight",
    formula: "SUM(savingsAmount) per vendor",
    apiField: "vendorAnalytics.savings",
    component: "VendorIntelligence",
  },
  vendorRanking: {
    label: "Vendor Ranking",
    sourceTable: "Vendor",
    formula: "ORDER BY vendorScore DESC",
    apiField: "vendorAnalytics.rank",
    component: "VendorIntelligence",
  },
};

export type VendorLike = {
  invoiceCount?: number;
  vendorScore?: number;
  pricingScore?: number;
  reliabilityScore?: number;
  accuracyScore?: number;
};

export type VendorRankLike = {
  rank?: number;
  savings?: number | null;
  preferred?: boolean;
};

export function hasVendorHistory(
  vendor: VendorLike | null | undefined
): boolean {
  return (
    (vendor?.invoiceCount ?? 0) >=
    MIN_VENDOR_INVOICES
  );
}

export function hasMetricScore(
  value: number | null | undefined
): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

export function vendorMetricAvailable(
  key: VendorMetricKey,
  vendor: VendorLike | null | undefined,
  rank?: VendorRankLike | null,
  savings?: number | null
): boolean {
  if (!hasVendorHistory(vendor)) {
    return false;
  }

  switch (key) {
    case "vendorScore":
      return hasMetricScore(
        vendor?.vendorScore
      );
    case "pricingScore":
      return hasMetricScore(
        vendor?.pricingScore
      );
    case "reliabilityScore":
      return hasMetricScore(
        vendor?.reliabilityScore
      );
    case "accuracyScore":
      return hasMetricScore(
        vendor?.accuracyScore
      );
    case "potentialAnnualSavings":
      return (
        savings != null && savings > 0
      );
    case "vendorRanking":
      return rank?.rank != null;
    default:
      return false;
  }
}
