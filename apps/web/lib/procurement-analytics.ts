import { apiFetch } from "./api";

export type ProcurementIntelligence = {
  spend: {
    totalSpend: number;
    monthlySpend: number;
    ytdSpend: number;
    averageInvoice: number | null;
    averagePO: number | null;
    spendByVendor: { vendor: string; spend: number }[];
    spendByDepartment: { department: string; spend: number }[];
    monthlyTrend: { month: string; spend: number }[];
    invoiceCount?: number;
    poCount?: number;
  };
  cycleTime: {
    requestToApproval: { hours: number | null; label: string };
    approvalToPO: { hours: number | null; label: string };
    poToInvoice: { days: number | null; label: string };
    invoiceToPayment: { days: number | null; label: string };
    averageProcurementCycleDays: number | null;
    averageProcurementCycleLabel?: string;
    completeChainCount?: number;
  };
  maverick: {
    maverickSpend: number;
    maverickPercent: number | null;
    totalSpend: number;
    count: number;
    topCases: {
      id: number;
      vendorName: string;
      amount: number;
      reasons: string[];
    }[];
  };
  budget: {
    forecasts: {
      department: string;
      budget: number;
      spent: number;
      monthlyBurn: number;
      monthsUntilExhausted: number | null;
      severity: "HIGH" | "MEDIUM" | "LOW";
      message: string;
    }[];
    atRisk: number;
  };
  vendors: {
    vendorId: number;
    vendorName: string;
    totalSpend: number;
    score: number;
    breakdown: {
      accuracy: number;
      reliability: number;
      risk: number;
      pricing: number;
    };
    metrics: {
      invoiceAccuracy: number;
      approvalRate: number;
      riskFrequency: number;
      spendTrend: string;
    };
  }[];
  generatedAt: string;
};

export async function getProcurementIntelligence(): Promise<ProcurementIntelligence> {
  const res = await apiFetch("/analytics/procurement");
  if (!res.ok) {
    throw new Error("Failed to load procurement intelligence");
  }
  return res.json();
}
