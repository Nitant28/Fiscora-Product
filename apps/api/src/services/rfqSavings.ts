/**
 * Domain: RFQ savings — negotiated savings vs highest bid when an RFQ is awarded.
 * Main exports: calculateRFQSavings, getRFQSavingsByRfqId, getRFQSavingsThisMonth, getTotalRFQSavings.
 * Called by: rfq.service.ts, executiveAnalytics.ts, controlTower.ts.
 */
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";

export async function calculateRFQSavings(
  rfqId: number,
  actor = "System"
) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
  });

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  if (rfq.status !== "AWARDED" || !rfq.awardedVendorId) {
    throw new Error("RFQ not awarded");
  }

  const bids = await prisma.vendorBid.findMany({
    where: { rfqId },
  });

  if (bids.length === 0) {
    throw new Error("No bids for RFQ");
  }

  const highestBid = Math.max(
    ...bids.map((b) => b.quotedAmount)
  );

  const winner = bids.find(
    (b) => b.vendorId === rfq.awardedVendorId
  );

  if (!winner) {
    throw new Error("Winning vendor bid not found");
  }

  const winningBid = winner.quotedAmount;
  const savings = Math.max(0, highestBid - winningBid);

  const record = await prisma.rFQSavings.upsert({
    where: { rfqId },
    create: {
      rfqId,
      winningVendorId: rfq.awardedVendorId,
      highestBid,
      winningBid,
      savings,
    },
    update: {
      winningVendorId: rfq.awardedVendorId,
      highestBid,
      winningBid,
      savings,
    },
    include: {
      vendor: { select: { id: true, name: true } },
      rfq: { select: { id: true, title: true } },
    },
  });

  await recordAuditLog(
    "RFQSavings",
    record.id,
    "RFQ_SAVINGS_RECORDED",
    actor,
    {
      newValue: {
        rfqId,
        highestBid,
        winningBid,
        savings,
        vendorName: record.vendor.name,
      },
    }
  );

  return record;
}

export async function getRFQSavingsByRfqId(rfqId: number) {
  const existing = await prisma.rFQSavings.findUnique({
    where: { rfqId },
    include: {
      vendor: { select: { id: true, name: true } },
    },
  });

  if (existing) {
    return existing;
  }

  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
  });

  if (
    rfq?.status === "AWARDED" &&
    rfq.awardedVendorId
  ) {
    return calculateRFQSavings(rfqId);
  }

  return null;
}

/* --- AGGREGATES --- */

export async function getRFQSavingsThisMonth() {
  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const rows = await prisma.rFQSavings.findMany({
    where: {
      createdAt: { gte: monthStart },
      savings: { gt: 0 },
    },
    select: { savings: true },
  });

  return rows.reduce(
    (sum, r) => sum + r.savings,
    0
  );
}

export async function getTotalRFQSavings() {
  const result =
    await prisma.rFQSavings.aggregate({
      _sum: { savings: true },
      where: { savings: { gt: 0 } },
    });

  return result._sum.savings ?? 0;
}
