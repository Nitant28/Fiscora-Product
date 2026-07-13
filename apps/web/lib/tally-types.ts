export type TallyExportFilters = {
  verifiedOnly: boolean;
  excludeOcr: boolean;
  excludeDuplicates: boolean;
  excludeInvalidGst: boolean;
  excludeDraft: boolean;
};

export type TallyReadinessRow = {
  vendorCode: string;
  vendorName: string;
  score: number;
  status: "READY" | "NOT READY" | "REVIEW";
};

export type TallyExportHistoryRow = {
  id: string;
  exportType: string;
  filename: string;
  rowCount: number;
  excludedCount: number;
  actorName: string;
  createdAt: string;
};

export type TallyExportSummary = {
  vendors: number;
  purchaseOrders: number;
  invoices: number;
  payments: number;
  totalVendors?: number;
  totalPurchaseOrders?: number;
  totalInvoices?: number;
  excludedVendors?: number;
  formats: string[];
  note: string;
  filters?: TallyExportFilters;
  readinessPreview?: TallyReadinessRow[];
  exportHistory?: TallyExportHistoryRow[];
};

export type TallyExportType =
  | "vendors"
  | "purchase-orders"
  | "invoices"
  | "payments";

export const DEFAULT_TALLY_FILTERS: TallyExportFilters = {
  verifiedOnly: true,
  excludeOcr: true,
  excludeDuplicates: true,
  excludeInvalidGst: true,
  excludeDraft: true,
};

export function tallyDownloadUrl(
  type: TallyExportType,
  filters: TallyExportFilters = DEFAULT_TALLY_FILTERS
) {
  const params = new URLSearchParams({
    format: "csv",
    verifiedOnly: String(filters.verifiedOnly),
    excludeOcr: String(filters.excludeOcr),
    excludeDuplicates: String(filters.excludeDuplicates),
    excludeInvalidGst: String(filters.excludeInvalidGst),
    excludeDraft: String(filters.excludeDraft),
  });

  return `/api/proxy/integrations/tally/${type}?${params.toString()}`;
}

export function filtersQueryString(
  filters: TallyExportFilters
): string {
  return new URLSearchParams({
    verifiedOnly: String(filters.verifiedOnly),
    excludeOcr: String(filters.excludeOcr),
    excludeDuplicates: String(filters.excludeDuplicates),
    excludeInvalidGst: String(filters.excludeInvalidGst),
    excludeDraft: String(filters.excludeDraft),
  }).toString();
}
