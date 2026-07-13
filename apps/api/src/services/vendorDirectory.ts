/**
 * Domain: Vendor master data — directory listing, 360° profile, and payment terms updates.
 * Main exports: listVendors, getVendor360, updateVendorPaymentTerms.
 * Called by: server.ts; vendorOnboarding.ts (activate flow).
 */
import prisma from "../db";
import { notDeleted } from "../lib/softDelete";
import { recordAuditLog } from "../lib/audit";
import { computeProcurementScore } from "./procurementScoring";
import {
  formatPaymentTermsLabel,
  isValidPaymentTermsDays,
} from "./paymentTerms";
import {
  assessContractRisk,
  syncContractStatuses,
} from "./contractRisk";

export async function listVendors() {
  return prisma.vendor.findMany({
    where: notDeleted,
    orderBy: [
      { preferredVendor: "desc" },
      { totalSpend: "desc" },
    ],
  });
}

/* --- VENDOR 360 --- */

export async function getVendor360(id: number) {
  const vendor =
    await prisma.vendor.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

  if (!vendor) {
    return null;
  }

  const approvedCount =
    vendor.documents.filter((d) =>
      ["approved", "paid"].includes(
        d.status
      )
    ).length;

  const approvalRate =
    vendor.invoiceCount > 0
      ? Math.round(
          (approvedCount /
            vendor.invoiceCount) *
            100
        )
      : 0;

  const healthScore = Math.round(
    (vendor.reliabilityScore +
      vendor.deliveryScore +
      vendor.priceCompetitivenessScore +
      vendor.invoiceAccuracyScore +
      vendor.responseTimeScore) /
      5
  );

  const procurementScore =
    vendor.procurementScore ??
    computeProcurementScore(vendor);

  await syncContractStatuses();

  const activeContracts =
    await prisma.contract.findMany({
      where: {
        ...notDeleted,
        vendorId: id,
        status: {
          in: [
            "ACTIVE",
            "EXPIRING",
            "EXPIRED",
          ],
        },
      },
      orderBy: [
        { value: "desc" },
        { endDate: "desc" },
      ],
      take: 1,
    });

  const primaryContract =
    activeContracts[0] ?? null;

  const contractSummary = primaryContract
    ? (() => {
        const risk = assessContractRisk(
          primaryContract.endDate
        );
        return {
          id: primaryContract.id,
          title: primaryContract.title,
          contractNumber:
            primaryContract.contractNumber,
          value: Number(primaryContract.value),
          endDate: primaryContract.endDate,
          daysRemaining: risk.daysRemaining,
          status: primaryContract.status,
          autoRenew: primaryContract.autoRenew,
          noticePeriodDays:
            primaryContract.renewalNoticeDays ??
            30,
          riskLevel: risk.level,
        };
      })()
    : null;

  return {
    ...vendor,
    healthScore,
    procurementScore,
    approvalRate,
    averagePrice: vendor.averageInvoice,
    contractSummary,
  };
}

/* --- PAYMENT TERMS --- */

export async function updateVendorPaymentTerms(
  vendorId: number,
  input: {
    paymentTermsDays: number;
    msmeRegistered?: boolean;
  },
  actor: string
) {
  if (
    !isValidPaymentTermsDays(
      input.paymentTermsDays
    )
  ) {
    throw new Error(
      "Invalid payment terms. Use Net 15, 30, 45, 60, or 90."
    );
  }

  const existing =
    await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

  if (!existing) {
    throw new Error("Vendor not found");
  }

  const paymentTerms =
    formatPaymentTermsLabel(
      input.paymentTermsDays
    );

  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      paymentTermsDays:
        input.paymentTermsDays,
      paymentTerms,
      ...(input.msmeRegistered != null
        ? {
            msmeRegistered:
              input.msmeRegistered,
          }
        : {}),
    },
  });

  await recordAuditLog(
    "Vendor",
    vendorId,
    "VENDOR_TERMS_UPDATED",
    actor,
    {
      oldValue: {
        paymentTerms:
          existing.paymentTerms,
        paymentTermsDays:
          existing.paymentTermsDays,
        msmeRegistered:
          existing.msmeRegistered,
      },
      newValue: {
        paymentTerms:
          vendor.paymentTerms,
        paymentTermsDays:
          vendor.paymentTermsDays,
        msmeRegistered:
          vendor.msmeRegistered,
      },
    }
  );

  return vendor;
}
