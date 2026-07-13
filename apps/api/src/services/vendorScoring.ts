/**
 * Domain: Vendor health — invoice-derived reliability, delivery, price, and accuracy scores persisted on vendors.
 * Main exports: findVendorDocuments, scoreVendorHealth, updateVendorHealthScores.
 * Called by: internal batch use (updateVendorHealthScores); procurementScoring refresh after score updates.
 */
import prisma from "../db";
import { normalizeVendor } from "../lib/vendorNormalizer";
import { getItemBenchmark } from "../procurement/benchmark";
import { refreshVendorProcurementScore } from "./procurementScoring";

export interface VendorHealth {
  reliability: number;
  delivery: number;
  priceCompetitiveness: number;
  invoiceAccuracy: number;
  responseTime: number;
  healthScore: number;
  invoiceCount: number;
  totalSpend: number;
}

export async function findVendorDocuments(
  vendorName: string
) {
  const normalized =
    normalizeVendor(vendorName);

  const all =
    await prisma.document.findMany({
      where: {
        vendorName: { not: null },
      },
      include: { lineItems: true },
    });

  return all.filter(
    (doc) =>
      doc.vendorName &&
      normalizeVendor(
        doc.vendorName
      ) === normalized
  );
}

/* --- SCORING --- */

export async function scoreVendorHealth(
  vendorName: string
): Promise<VendorHealth | null> {
  const invoices =
    await findVendorDocuments(
      vendorName
    );

  const invoiceCount =
    invoices.length;

  const totalSpend = invoices.reduce(
    (sum, doc) =>
      sum + (doc.totalAmount ?? 0),
    0
  );

  if (invoiceCount === 0) {
    return null;
  }

  const failedInvoices =
    invoices.filter(
      (doc) => doc.status === "failed"
    ).length;

  const reliability = Math.round(
    Math.max(
      0,
      100 -
        (failedInvoices /
          invoiceCount) *
          100
    )
  );

  const documentIds =
    invoices.map((d) => d.id);

  const corrections =
    await prisma.extractionCorrection.count(
      {
        where: {
          documentId: {
            in: documentIds,
          },
        },
      }
    );

  const invoiceAccuracy = Math.round(
    Math.max(
      0,
      100 -
        (corrections / invoiceCount) *
          100
    )
  );

  const matchedPos =
    await prisma.document.count({
      where: {
        id: { in: documentIds },
        purchaseOrderId: { not: null },
      },
    });

  const delivery = Math.round(
    (matchedPos / invoiceCount) * 100
  );

  const ratios: number[] = [];

  for (const invoice of invoices) {
    for (const item of invoice.lineItems) {
      if (!item.rate || item.rate <= 0) {
        continue;
      }

      const benchmark =
        await getItemBenchmark(
          item.description,
          item.category,
          invoice.id
        );

      if (
        !benchmark ||
        benchmark.averageRate <= 0
      ) {
        continue;
      }

      ratios.push(
        item.rate /
          benchmark.averageRate
      );
    }
  }

  let priceCompetitiveness = 50;

  if (ratios.length > 0) {
    const avgRatio =
      ratios.reduce(
        (sum, r) => sum + r,
        0
      ) / ratios.length;

    if (avgRatio <= 1) {
      priceCompetitiveness = Math.round(
        50 + (1 - avgRatio) * 50
      );
    } else {
      priceCompetitiveness = Math.round(
        Math.max(
          0,
          50 - (avgRatio - 1) * 100
        )
      );
    }
  }

  priceCompetitiveness = Math.max(
    0,
    Math.min(100, priceCompetitiveness)
  );

  const approvedCount =
    invoices.filter((d) =>
      ["approved", "paid"].includes(
        d.status
      )
    ).length;

  const responseTime = Math.round(
    (approvedCount / invoiceCount) * 100
  );

  const healthScore = Math.round(
    (reliability +
      delivery +
      priceCompetitiveness +
      invoiceAccuracy +
      responseTime) /
      5
  );

  return {
    reliability,
    delivery,
    priceCompetitiveness,
    invoiceAccuracy,
    responseTime,
    healthScore,
    invoiceCount,
    totalSpend,
  };
}

/* --- BATCH UPDATE --- */

export async function updateVendorHealthScores(
  vendorId: number,
  vendorName: string
) {
  const health =
    await scoreVendorHealth(vendorName);

  if (!health) {
    return null;
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      reliabilityScore:
        health.reliability,
      deliveryScore: health.delivery,
      priceCompetitivenessScore:
        health.priceCompetitiveness,
      invoiceAccuracyScore:
        health.invoiceAccuracy,
      responseTimeScore:
        health.responseTime,
      invoiceCount: health.invoiceCount,
      totalSpend: health.totalSpend,
    },
  });

  await refreshVendorProcurementScore(vendorId);

  return updated;
}
