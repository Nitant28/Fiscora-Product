/**
 * Sprint 16 — Vendor performance scorecard.
 */
import prisma from "../db";
import { notDeleted } from "../lib/softDelete";

export async function getVendorPerformanceScorecards(limit = 10) {
  const vendors = await prisma.vendor.findMany({
    where: notDeleted,
    orderBy: { totalSpend: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      totalSpend: true,
      preferredVendor: true,
      invoiceAccuracyScore: true,
      deliveryScore: true,
      reliabilityScore: true,
      priceCompetitivenessScore: true,
      responseTimeScore: true,
      procurementScore: true,
      documents: {
        where: notDeleted,
        select: {
          status: true,
          totalAmount: true,
          createdAt: true,
          flags: { where: { resolved: false }, select: { id: true } },
        },
      },
    },
  });

  return vendors.map((vendor) => {
    const docs = vendor.documents;
    const total = docs.length;
    const approved = docs.filter((d) =>
      ["approved", "paid", "processed"].includes(d.status)
    ).length;
    const failed = docs.filter((d) => d.status === "failed").length;
    const flagCount = docs.reduce((s, d) => s + d.flags.length, 0);

    const accuracy =
      vendor.invoiceAccuracyScore ||
      (total > 0 ? Math.round(((total - failed) / total) * 100) : 0);
    const approvalRate =
      total > 0 ? Math.round((approved / total) * 100) : 0;
    const riskScore =
      total > 0
        ? Math.max(0, Math.round(100 - (flagCount / total) * 100))
        : 100;

    const recent = docs.filter(
      (d) =>
        d.createdAt >=
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    );
    const prior = docs.filter(
      (d) =>
        d.createdAt <
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    );
    const recentSpend = recent.reduce(
      (s, d) => s + (d.totalAmount ?? 0),
      0
    );
    const priorSpend = prior.reduce(
      (s, d) => s + (d.totalAmount ?? 0),
      0
    );
    let spendTrend: "up" | "down" | "flat" = "flat";
    if (recentSpend > priorSpend * 1.1) spendTrend = "up";
    else if (recentSpend < priorSpend * 0.9) spendTrend = "down";

    const reliability = vendor.reliabilityScore || approvalRate;
    const pricing = vendor.priceCompetitivenessScore || 80;

    const overall = Math.round(
      (accuracy + reliability + riskScore + pricing) / 4
    );

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      totalSpend: Math.round(vendor.totalSpend),
      preferredVendor: vendor.preferredVendor,
      score: vendor.procurementScore ?? overall,
      breakdown: {
        accuracy,
        reliability,
        risk: riskScore,
        pricing,
      },
      metrics: {
        invoiceAccuracy: accuracy,
        approvalRate,
        riskFrequency: flagCount,
        spendTrend,
      },
    };
  });
}
