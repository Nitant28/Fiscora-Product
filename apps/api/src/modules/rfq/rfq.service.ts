import prisma from "../../db";
import {
  type AuditActorContext,
  recordAuditLog,
} from "../../lib/audit";
import { notifyRfqAwarded, notifyRfqOpened } from "../../services/notificationService";
import { rankBidsWithExplanation } from "../../services/recommendationEngine";
import { calculateRFQSavings, getRFQSavingsByRfqId } from "../../services/rfqSavings";
import { computeProcurementScore } from "../../services/procurementScoring";
import {
  calculateVendorRank,
  normalizeDelivery,
  normalizePrice,
  normalizeWarranty,
  roundRankScore,
} from "../../services/vendorRanking";

export async function createRFQ(data: {
  title: string;
  description?: string;
  categoryId: number;
  createdById: number;
}) {
  return prisma.rFQ.create({
    data,
    include: {
      category: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function listRFQs() {
  return prisma.rFQ.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      awardedVendor: {
        select: { id: true, name: true },
      },
      savings: true,
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          status: true,
        },
      },
    },
  });
}

export async function getRFQ(rfqId: number) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
    include: {
      category: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      awardedVendor: {
        select: { id: true, name: true },
      },
      savings: {
        include: {
          vendor: {
            select: { id: true, name: true },
          },
        },
      },
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          vendorName: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  return rfq;
}

export async function submitBid(data: {
  rfqId: number;
  vendorId: number;
  quotedAmount: number;
  leadTimeDays: number;
  warrantyMonths: number;
  notes?: string;
}) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: data.rfqId },
  });

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  if (
    rfq.status === "CLOSED" ||
    rfq.status === "AWARDED"
  ) {
    throw new Error(
      "RFQ no longer accepting bids"
    );
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: data.vendorId },
  });

  if (!vendor) {
    throw new Error("Vendor not found");
  }

  const bid = await prisma.vendorBid.create({
    data,
    include: {
      vendor: true,
      rfq: true,
    },
  });

  await recordAuditLog(
    "VendorBid",
    bid.id,
    "RFQ_BID_SUBMITTED",
    vendor.name,
    {
      newValue: {
        rfqId: data.rfqId,
        vendorId: data.vendorId,
        quotedAmount: data.quotedAmount,
        leadTimeDays: data.leadTimeDays,
        warrantyMonths: data.warrantyMonths,
        notes: data.notes ?? null,
      },
    }
  );

  return bid;
}

export async function getRFQBids(rfqId: number) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
  });

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  return prisma.vendorBid.findMany({
    where: { rfqId },
    include: { vendor: true },
    orderBy: [{ score: "desc" }, { quotedAmount: "asc" }],
  });
}

export async function scoreRFQ(rfqId: number) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
  });

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  const bids = await prisma.vendorBid.findMany({
    where: { rfqId },
    include: { vendor: true },
  });

  if (bids.length === 0) {
    throw new Error("No bids to score");
  }

  const prices = bids.map((b) => b.quotedAmount);
  const deliveries = bids.map((b) => b.leadTimeDays);
  const warranties = bids.map((b) => b.warrantyMonths);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDelivery = Math.min(...deliveries);
  const maxDelivery = Math.max(...deliveries);
  const minWarranty = Math.min(...warranties);
  const maxWarranty = Math.max(...warranties);

  for (const bid of bids) {
    const priceScore = normalizePrice(
      bid.quotedAmount,
      minPrice,
      maxPrice
    );
    const deliveryScore = normalizeDelivery(
      bid.leadTimeDays,
      minDelivery,
      maxDelivery
    );
    const warrantyScore = normalizeWarranty(
      bid.warrantyMonths,
      minWarranty,
      maxWarranty
    );
    const vendorPerformance =
      bid.vendor.procurementScore ??
      computeProcurementScore(bid.vendor);

    const rankScore = roundRankScore(
      calculateVendorRank(
        priceScore,
        deliveryScore,
        vendorPerformance,
        warrantyScore
      )
    );

    await prisma.vendorBid.update({
      where: { id: bid.id },
      data: { score: rankScore },
    });
  }

  return getRFQBids(rfqId);
}

export async function getRFQRecommendation(rfqId: number) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
  });

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  const bids = await prisma.vendorBid.findMany({
    where: { rfqId },
    include: { vendor: true },
  });

  if (bids.length === 0) {
    throw new Error("No bids to recommend");
  }

  const rankings = rankBidsWithExplanation(bids);
  const top = rankings[0]!;

  return {
    recommendedVendor: top.vendorName,
    score: top.score,
    reason: top.explanation,
    recommendation: top,
    rankings,
  };
}

export async function awardVendor(
  rfqId: number,
  vendorId: number,
  awardedBy: string,
  actorContext?: AuditActorContext
) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
  });

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  if (rfq.status === "AWARDED") {
    throw new Error("RFQ already awarded");
  }

  if (rfq.status === "CLOSED") {
    throw new Error("RFQ is closed");
  }

  if (rfq.status !== "OPEN") {
    throw new Error("RFQ must be OPEN before awarding");
  }

  const bid = await prisma.vendorBid.findFirst({
    where: { rfqId, vendorId },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!bid) {
    throw new Error("Vendor not eligible");
  }

  const updated = await prisma.$transaction(async (tx) => {
    return tx.rFQ.update({
      where: { id: rfqId },
      data: {
        status: "AWARDED",
        awardedVendorId: vendorId,
      },
      include: {
        awardedVendor: true,
        category: true,
      },
    });
  });

  await recordAuditLog(
    "RFQ",
    rfqId,
    "RFQ_AWARDED",
    awardedBy,
    {
      newValue: {
        vendorId,
        vendorName: bid.vendor.name,
        quotedAmount: bid.quotedAmount,
        status: "AWARDED",
      },
      actorContext,
    }
  );

  await calculateRFQSavings(rfqId, awardedBy);

  void notifyRfqAwarded(
    { id: updated.id, title: updated.title },
    {
      name: bid.vendor.name,
      email: bid.vendor.email,
    },
    awardedBy
  ).catch(console.error);

  return updated;
}

export async function openRFQ(
  rfqId: number,
  actor: string,
  actorContext?: AuditActorContext
) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
  });

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  if (rfq.status === "AWARDED") {
    throw new Error("RFQ already awarded");
  }

  if (rfq.status === "CLOSED") {
    throw new Error("RFQ is closed");
  }

  if (rfq.status === "OPEN") {
    return rfq;
  }

  const updated = await prisma.rFQ.update({
    where: { id: rfqId },
    data: { status: "OPEN" },
  });

  await recordAuditLog(
    "RFQ",
    rfqId,
    "RFQ_OPENED",
    actor,
    {
      oldValue: { status: rfq.status },
      newValue: { status: "OPEN" },
      actorContext,
    }
  );

  void notifyRfqOpened(
    { id: updated.id, title: updated.title },
    actor
  ).catch(console.error);

  return updated;
}

export async function getRFQSavings(rfqId: number) {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
  });

  if (!rfq) {
    throw new Error("RFQ not found");
  }

  const savings = await getRFQSavingsByRfqId(rfqId);

  if (!savings) {
    throw new Error("Savings not available");
  }

  return savings;
}
