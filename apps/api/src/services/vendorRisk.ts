/**
 * Domain: Vendor concentration risk — spend share analysis and dependency exposure for executives.
 * Main exports: classifyVendorShare, getVendorRiskAnalysis, getVendorRiskExposure, getHighConcentrationVendorCount,
 *   getTopVendorDependencyRisk, getCriticalAndHighVendors.
 * Called by: modules/analytics/analytics.routes.ts, executiveAnalytics.ts, controlTower.ts;
 *   scripts/verify-vendor-concentration-risk.ts, verify-dashboard-data-quality.ts.
 */
import prisma from "../db";

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

export type VendorRiskAnalysis = {
  vendors: VendorRiskRow[];
  totalSpend: number;
  exposure: VendorRiskExposure;
  source: "paid_invoices" | "paid_payments";
  asOf: string;
};

function normalizeVendorName(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) {
    return null;
  }

  return value.trim();
}

export function classifyVendorShare(
  sharePercent: number
): VendorConcentrationLevel {
  if (sharePercent >= 60) {
    return "CRITICAL";
  }

  if (sharePercent >= 40) {
    return "HIGH";
  }

  if (sharePercent >= 20) {
    return "MEDIUM";
  }

  return "LOW";
}

function buildExposure(
  vendors: VendorRiskRow[]
): VendorRiskExposure {
  return vendors.reduce(
    (counts, vendor) => {
      counts[vendor.risk.toLowerCase() as keyof VendorRiskExposure] +=
        1;
      return counts;
    },
    {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }
  );
}

async function aggregatePaidInvoiceSpend() {
  const invoices =
    await prisma.document.findMany({
      where: {
        status: "paid",
        totalAmount: { gt: 0 },
      },
      select: {
        vendorId: true,
        vendorName: true,
        totalAmount: true,
        vendor: {
          select: { id: true, name: true },
        },
      },
    });

  const byVendor = new Map<
    string,
    {
      vendorId: number | null;
      name: string;
      spend: number;
    }
  >();

  for (const invoice of invoices) {
    const name =
      invoice.vendor?.name ??
      normalizeVendorName(
        invoice.vendorName
      );

    if (!name) {
      continue;
    }

    const key =
      invoice.vendorId != null
        ? `id:${invoice.vendorId}`
        : `name:${name.toLowerCase()}`;

    const entry =
      byVendor.get(key) ?? {
        vendorId: invoice.vendorId,
        name,
        spend: 0,
      };

    entry.spend += invoice.totalAmount ?? 0;
    byVendor.set(key, entry);
  }

  return {
    source: "paid_invoices" as const,
    rows: Array.from(byVendor.values()),
  };
}

async function aggregatePaidPaymentSpend() {
  const payments =
    await prisma.payment.findMany({
      where: {
        status: "PAID",
        amount: { gt: 0 },
        document: {
          status: { not: "paid" },
        },
      },
      include: {
        vendor: {
          select: { id: true, name: true },
        },
      },
    });

  const byVendor = new Map<
    string,
    {
      vendorId: number | null;
      name: string;
      spend: number;
    }
  >();

  for (const payment of payments) {
    const name = payment.vendor.name;
    const key = `id:${payment.vendorId}`;

    const entry =
      byVendor.get(key) ?? {
        vendorId: payment.vendorId,
        name,
        spend: 0,
      };

    entry.spend += payment.amount;
    byVendor.set(key, entry);
  }

  return {
    source: "paid_payments" as const,
    rows: Array.from(byVendor.values()),
  };
}

function toVendorRiskRows(
  rows: Array<{
    vendorId: number | null;
    name: string;
    spend: number;
  }>,
  totalSpend: number,
  source: VendorRiskAnalysis["source"]
): VendorRiskRow[] {
  return rows
    .map((row) => {
      const share =
        totalSpend > 0
          ? (row.spend / totalSpend) * 100
          : 0;

      return {
        vendorId: row.vendorId,
        name: row.name,
        spend: row.spend,
        share:
          Math.round(share * 10) / 10,
        risk: classifyVendorShare(share),
        source,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

async function aggregateCombinedPaidSpend() {
  const [invoiceRows, paymentRows] =
    await Promise.all([
      aggregatePaidInvoiceSpend(),
      aggregatePaidPaymentSpend(),
    ]);

  const byVendor = new Map<
    string,
    {
      vendorId: number | null;
      name: string;
      spend: number;
    }
  >();

  for (const row of invoiceRows.rows) {
    const key =
      row.vendorId != null
        ? `id:${row.vendorId}`
        : `name:${row.name.toLowerCase()}`;
    const entry =
      byVendor.get(key) ?? {
        vendorId: row.vendorId,
        name: row.name,
        spend: 0,
      };
    entry.spend += row.spend;
    byVendor.set(key, entry);
  }

  for (const row of paymentRows.rows) {
    const key = `id:${row.vendorId}`;
    const entry =
      byVendor.get(key) ?? {
        vendorId: row.vendorId,
        name: row.name,
        spend: 0,
      };
    entry.spend += row.spend;
    byVendor.set(key, entry);
  }

  const rows = Array.from(byVendor.values());

  let source: VendorRiskAnalysis["source"] =
    "paid_payments";
  if (
    invoiceRows.rows.length > 0 &&
    paymentRows.rows.length > 0
  ) {
    source = "paid_invoices";
  } else if (invoiceRows.rows.length > 0) {
    source = "paid_invoices";
  }

  return { source, rows };
}

/* --- RISK ANALYSIS --- */

export async function getVendorRiskAnalysis(): Promise<VendorRiskAnalysis> {
  const { source, rows } =
    await aggregateCombinedPaidSpend();

  const totalSpend = rows.reduce(
    (sum, row) => sum + row.spend,
    0
  );

  const vendors = toVendorRiskRows(
    rows,
    totalSpend,
    source
  );

  return {
    vendors,
    totalSpend,
    exposure: buildExposure(vendors),
    source,
    asOf: new Date().toISOString(),
  };
}

export async function getVendorRiskExposure(): Promise<VendorRiskExposure> {
  const analysis =
    await getVendorRiskAnalysis();
  return analysis.exposure;
}

/* --- DASHBOARD HELPERS --- */

export async function getHighConcentrationVendorCount() {
  const analysis =
    await getVendorRiskAnalysis();

  return analysis.vendors.filter(
    (vendor) =>
      vendor.risk === "HIGH" ||
      vendor.risk === "CRITICAL"
  ).length;
}

export async function getTopVendorDependencyRisk() {
  const analysis =
    await getVendorRiskAnalysis();

  return (
    analysis.vendors.find(
      (vendor) =>
        vendor.risk === "CRITICAL" ||
        vendor.risk === "HIGH"
    ) ??
    analysis.vendors[0] ??
    null
  );
}

export async function getCriticalAndHighVendors(
  limit = 5
) {
  const analysis =
    await getVendorRiskAnalysis();

  return analysis.vendors
    .filter(
      (vendor) =>
        vendor.risk === "CRITICAL" ||
        vendor.risk === "HIGH"
    )
    .slice(0, limit);
}
