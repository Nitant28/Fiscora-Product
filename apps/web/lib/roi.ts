import { apiFetch } from "./api";

export type RoiDashboard = {
  headline: string;
  pillars: {
    moneySaved: { label: string; amount: number; display: string; detail: string };
    fraudPrevented: { label: string; amount: number; display: string; detail: string };
    approvalTimeReduced: { label: string; amount: number; display: string; detail: string };
    vendorRisksReduced: { label: string; amount: number; display: string; detail: string };
  };
  proofPoints: { label: string; value: string }[];
  topWins: { title: string; amount: number; vendorName: string | null }[];
  monthlyReport: {
    month: string;
    spendControlled: number;
    savingsGenerated: number;
    complianceScore: number;
    fraudAlertsPrevented: number;
    topRiskVendor: string;
  };
  generatedAt: string;
};

export async function getRoiDashboard(): Promise<RoiDashboard> {
  const res = await apiFetch("/roi/dashboard");

  if (!res.ok) {
    throw new Error("Failed to load ROI dashboard");
  }

  return res.json();
}
