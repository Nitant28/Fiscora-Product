import { apiFetch } from "./api";

export type SavingsDashboard = {
  summary: {
    annualSavings: number;
    rfqSavings: number;
    contractSavings: number;
    budgetAvoidance: number;
    vendorConsolidation: number;
    negotiatedSavings: number;
    avoidedSpend: number;
    fraudPrevented: number;
    contractOptimization: number;
    totalImpact: number;
  };
  departmentSavings: {
    department: string;
    amount: number;
  }[];
  topWins: {
    title: string;
    amount: number;
    vendorName: string | null;
  }[];
  opportunities: {
    id: string;
    title: string;
    recommendation: string;
    impact: string;
    severity: string;
    action: string;
    contractId?: number;
    vendorName?: string;
  }[];
  monthlyReport: {
    month: string;
    spendControlled: number;
    savingsGenerated: number;
    complianceScore: number;
    fraudAlertsPrevented: number;
    topRiskVendor: string;
  };
  recentEvents: {
    id: number;
    type: string;
    amount: number;
    title: string | null;
    vendorName: string | null;
    createdAt: string;
  }[];
  generatedAt: string;
};

export async function getSavingsDashboard(): Promise<SavingsDashboard> {
  const res = await apiFetch("/savings/dashboard");

  if (!res.ok) {
    throw new Error("Failed to load savings intelligence");
  }

  return res.json();
}
