/**
 * TypeScript shapes for analytics and intelligence API responses.
 * Mirrors backend DTOs consumed by dashboard, CFO, RFQ, and invoice pages.
 */

// ---------------------------------------------------------------------------
// Executive dashboard (control tower / home analytics)
// ---------------------------------------------------------------------------

export type ExecutiveAnalyticsData = {
  poProgramActive: boolean;
  poCompliancePercent: number | null;
  invoicesWaitingApproval: number;
  pendingRequestApprovals: number;
  averageApprovalTimeHours: number | null;
  hasEnoughApprovalData: boolean;
  duplicateInvoiceCount: number;
  policyViolations: {
    duplicateInvoices: number;
    splitPurchases: number;
    approvalBypassAttempts: number;
    total: number;
  };
  vendorRiskExposure: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  topVendorDependency: {
    name: string;
    spend: number;
    share: number;
    risk: string;
  } | null;
  contractExposure: {
    activeContracts: number;
    totalValue: number;
    utilized: number;
    remaining: number;
    criticalExpirations: number;
    within30Days: number;
    within60Days: number;
    within90Days: number;
    contractsRequiringAction?: number;
  };
  expiringContracts: {
    id: number;
    contractNumber: string;
    title: string;
    vendorName: string;
    daysRemaining: number;
    severity: string;
    renewalRequired: boolean;
  }[];
  budgetUtilization: {
    department: string;
    budget: number;
    spentBudget: number;
    reservedBudget: number;
    committedBudget: number;
    available: number;
    utilization: number;
  }[];
  departmentSpend: {
    department: string;
    budget: number;
    reservedBudget: number;
    committedBudget: number;
    spentBudget: number;
    available: number;
  }[];
  monthlySpendTrend: {
    month: string;
    spend: number;
  }[];
  topVendors: {
    vendor: string;
    spend: number;
  }[];
  poCycleTimeHours: number | null;
  poSavingsThisMonth: number;
  rfqSavingsThisMonth: number;
  totalSavingsThisMonth: number;
  poSavingsTotal: number;
  rfqSavingsTotal: number;
  totalSavings: number;
  savingsRate: number;
  savingsThisMonth: number;
};

export type ExecutiveAnalyticsResponse = {
  success: true;
  data: ExecutiveAnalyticsData;
};

// ---------------------------------------------------------------------------
// Category and vendor spend breakdowns
// ---------------------------------------------------------------------------

export type CategoryAnalyticsRow = {
  category: string;
  spend: number;
  invoices: number;
  percent: number;
};

export type CategoryAnalyticsResponse = {
  success: true;
  categories: CategoryAnalyticsRow[];
  totalSpend: number;
};

export type VendorSpendRow = {
  vendor: string;
  spend: number;
  invoiceCount: number;
};

export type VendorSpendResponse = {
  success: true;
  vendors: VendorSpendRow[];
};

// ---------------------------------------------------------------------------
// Invoice PO matching and approval workflow
// ---------------------------------------------------------------------------

export type PoMatchResult = {
  matched: boolean;
  poMatch: {
    poNumber: string;
    poAmount: number;
    invoiceAmount: number;
    variance: number;
    variancePercent: number;
    withinTolerance: boolean;
    riskLevel: "PASS" | "REVIEW" | "HIGH_RISK";
    matchConfidence?: number;
  } | null;
};

export type ApprovalStatus = {
  label: string;
  detail: string | null;
};

// ---------------------------------------------------------------------------
// Line-item price intelligence (historical benchmarks per SKU/description)
// ---------------------------------------------------------------------------

export type ItemIntelligence = {
  lineItemId: number;
  description: string;
  currentPrice: number | null;
  historicalAveragePrice: number | null;
  lowestPriceSeen: number | null;
  highestPriceSeen: number | null;
  vendorAveragePrice: number | null;
  priceVariance: number | null;
  potentialSavings: number | null;
  sampleCount: number;
  availability: boolean;
  source: string;
};

export type ApprovalHistoryEntry = {
  id: number;
  action: string;
  reason: string | null;
  user: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// CFO cash-flow dashboard (outflows, upcoming payments, vendor mix)
// ---------------------------------------------------------------------------

export type CfoUpcomingPayment = {
  id: number;
  vendorId: number;
  vendorName: string;
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  daysRemaining: number;
  status: string;
};

export type CfoVendorOutflow = {
  vendorId: number;
  vendorName: string;
  totalAmount: number;
  paymentCount: number;
};

export type CfoPaymentStatusMix = {
  status: string;
  count: number;
  amount: number;
};

export type CfoDashboardData = {
  sevenDayOutflow: number;
  thirtyDayOutflow: number;
  ninetyDayOutflow: number;
  asOf: string;
  upcomingPayments: CfoUpcomingPayment[];
  topVendors: CfoVendorOutflow[];
  paymentStatusMix: CfoPaymentStatusMix[];
};

export type CfoDashboardResponse = {
  success: true;
  data: CfoDashboardData;
};

// ---------------------------------------------------------------------------
// Vendor concentration and risk exposure analytics
// ---------------------------------------------------------------------------

export type VendorConcentrationLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type VendorRiskRow = {
  vendorId: number | null;
  name: string;
  spend: number;
  share: number;
  risk: VendorConcentrationLevel;
  source: "paid_invoices" | "paid_payments";
};

export type VendorRiskExposure = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type VendorRiskResponse = {
  success: true;
  vendors: VendorRiskRow[];
  totalSpend: number;
  exposure: VendorRiskExposure;
  source: "paid_invoices" | "paid_payments";
  asOf: string;
};
