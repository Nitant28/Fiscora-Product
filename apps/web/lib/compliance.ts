import { apiFetch } from "./api";

export interface ComplianceSummary {
  highRiskVendors: number;
  gstIssues: number;
  missingPan: number;
  pendingKyc: number;
  expiringDocuments: number;
}

export interface ComplianceRiskReason {
  code: string;
  label: string;
  points: number;
}

export interface ComplianceVendorRow {
  vendorId: number;
  vendorName: string;
  gstNumber: string | null;
  gstValid: boolean | null;
  gstStatus: string;
  panNumber: string | null;
  kycStatus: string;
  complianceRiskScore: number;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskFactors: string[];
  reasons: ComplianceRiskReason[];
  vendorStatus: string;
}

export interface GstIssueRow {
  vendorId: number;
  vendorName: string;
  gstin: string | null;
  issue: string;
  detectedAt: string;
}

export interface ComplianceDrillDown {
  gstIssues: GstIssueRow[];
  highRiskVendors: ComplianceVendorRow[];
  missingPan: ComplianceVendorRow[];
  pendingKyc: ComplianceVendorRow[];
  expiringDocuments: {
    vendorId: number;
    vendorName: string;
    documentType: string;
    fileName: string;
    expiryDate: string;
  }[];
}

export interface ComplianceVendorsResponse {
  vendors: ComplianceVendorRow[];
  summary: ComplianceSummary;
  drillDown: ComplianceDrillDown;
}

export interface VendorComplianceProfile {
  vendor: {
    id: number;
    name: string;
    email: string | null;
    status: string;
    kycStatus: string;
    gstNumber: string | null;
    panNumber: string | null;
    msmeNumber: string | null;
    createdAt: string;
  };
  compliance: {
    riskScore: number;
    riskLevel: string;
    reasons: ComplianceRiskReason[];
    gstStatus: string;
  };
  gst: {
    isValid: boolean;
    stateCode: string | null;
    panDerived: string | null;
    lastCheckedAt: string;
    history: {
      gstNumber: string;
      isValid: boolean;
      lastCheckedAt: string;
    }[];
  } | null;
  documents: {
    id: number;
    type: string;
    fileName: string;
    verificationStatus: string;
    uploadedAt: string;
    expiryDate: string | null;
  }[];
  recentViolations: {
    id: number;
    type: string;
    action: string;
    actor: string;
    requestId: string | null;
    message?: string;
    createdAt: string;
  }[];
  payments: {
    id: number;
    amount: number;
    status: string;
    dueDate: string;
    paidDate: string | null;
    isLate: boolean;
  }[];
  contracts: {
    id: number;
    contractNumber: string;
    title: string;
    status: string;
    endDate: string;
  }[];
}

export async function getComplianceVendors(): Promise<ComplianceVendorsResponse> {
  const res = await apiFetch("/compliance/vendors");

  if (!res.ok) {
    throw new Error("Failed to load compliance vendors");
  }

  return res.json();
}

export async function getComplianceGst(): Promise<{
  validations: unknown[];
}> {
  const res = await apiFetch("/compliance/gst");

  if (!res.ok) {
    throw new Error("Failed to load GST validations");
  }

  return res.json();
}

export async function getComplianceRisks() {
  const res = await apiFetch("/compliance/risks");

  if (!res.ok) {
    throw new Error("Failed to load compliance risks");
  }

  return res.json();
}

export async function getVendorComplianceProfile(
  vendorId: number
): Promise<VendorComplianceProfile> {
  const res = await apiFetch(
    `/compliance/vendor/${vendorId}`
  );

  if (!res.ok) {
    throw new Error("Failed to load vendor compliance profile");
  }

  return res.json();
}
