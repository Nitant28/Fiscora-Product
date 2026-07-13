/**
 * Domain: Vendor performance — composite procurement score from delivery, accuracy, price, reliability.
 * Main exports: computeProcurementScore, refreshVendorProcurementScore, refreshAllVendorProcurementScores.
 * Called by: rfq.service.ts, recommendationEngine.ts, vendorDirectory.ts, vendorScoring.ts, lib/seed.ts.
 */
import prisma from "../db";
import { vendorScore } from "./budgetEngine";

export function computeProcurementScore(vendor: {
  deliveryScore: number;
  invoiceAccuracyScore: number;
  priceCompetitivenessScore: number;
  reliabilityScore: number;
}) {
  return Math.round(
    vendorScore(
      vendor.deliveryScore,
      vendor.invoiceAccuracyScore,
      vendor.priceCompetitivenessScore,
      vendor.reliabilityScore
    )
  );
}

/* --- PERSISTENCE --- */

export async function refreshVendorProcurementScore(
  vendorId: number
) {
  const vendor =
    await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

  if (!vendor) {
    return null;
  }

  const procurementScore =
    computeProcurementScore(vendor);

  return prisma.vendor.update({
    where: { id: vendorId },
    data: { procurementScore },
  });
}

export async function refreshAllVendorProcurementScores() {
  const vendors =
    await prisma.vendor.findMany();

  for (const vendor of vendors) {
    const score =
      computeProcurementScore(vendor);

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { procurementScore: score },
    });
  }
}
