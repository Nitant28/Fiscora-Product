import { apiFetch } from "./api";

export type ContractIntelligenceDashboard = {
  summary: {
    expiringSoon: number;
    autoRenewals: number;
    underutilized: number;
    overutilized: number;
    highValueTotal: number;
    highDependencyVendors: number;
    activeContracts: number;
  };
  expiring: {
    id: number;
    contractNumber: string;
    title: string;
    vendorName: string;
    endDate: string;
    daysRemaining: number;
    contractValue: number;
    urgency: "critical" | "warning" | "healthy";
    autoRenew: boolean;
    renewalRequired: boolean;
  }[];
  autoRenewals: {
    id: number;
    contractNumber: string;
    title: string;
    vendorName: string;
    endDate: string;
    daysRemaining: number;
    autoRenew: boolean;
    renewalNoticeDays: number;
    noticeDeadline: string;
    contractValue: number;
    urgency: "critical" | "warning" | "healthy";
    risk: string;
  }[];
  underutilized: {
    id: number;
    contractNumber: string;
    title: string;
    vendorName: string;
    contractValue: number;
    spend: number;
    remaining: number;
    utilizationPercent: number;
    ownerDepartment: string | null;
    contractCategory: string | null;
    trend: string;
  }[];
  overutilized: {
    id: number;
    contractNumber: string;
    title: string;
    vendorName: string;
    contractValue: number;
    spend: number;
    remaining: number;
    utilizationPercent: number;
    urgency: string;
  }[];
  concentration: {
    vendorId: number;
    vendorName: string;
    spend: number;
    contractValue: number;
    spendPercent: number;
    highDependency: boolean;
  }[];
  calendar: {
    month: string;
    monthKey: string;
    items: {
      id: number;
      title: string;
      vendorName: string;
      endDate: string;
      autoRenew: boolean;
    }[];
  }[];
  generatedAt: string;
};

export async function getContractIntelligence(): Promise<ContractIntelligenceDashboard> {
  const res = await apiFetch("/contracts/intelligence");

  if (!res.ok) {
    throw new Error("Failed to load contract intelligence");
  }

  const data = await res.json();
  return data;
}
