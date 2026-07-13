export type VarianceResult = {
  variance: number;
  variancePercent: number;
  withinTolerance: boolean;
};

export type PoMatchResult = {
  poNumber: string;
  poAmount: number;
  invoiceAmount: number;
  variance: number;
  variancePercent: number;
  withinTolerance: boolean;
  riskLevel: "PASS" | "REVIEW" | "HIGH_RISK";
  matchConfidence?: number;
};

export type MatchInvoiceResult = {
  matched: boolean;
  poMatch: PoMatchResult | null;
};

export type GeneratePOInput = {
  requestId: number;
  actor: string;
};

export type ThreeWayMatchResult = {
  status: string;
  variance: number | null;
};
