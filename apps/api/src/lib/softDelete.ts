/**
 * Soft-delete helpers — enterprise records are never hard-deleted.
 */
import prisma from "../db";
import { recordAuditLog } from "./audit";

export const notDeleted = { deletedAt: null } as const;

export async function softDeleteVendor(
  vendorId: number,
  actor: string
) {
  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      deletedAt: new Date(),
      status: "SUSPENDED",
    },
  });

  await recordAuditLog(
    "Vendor",
    vendorId,
    "Vendor Soft Deleted",
    actor,
    { newValue: { deletedAt: vendor.deletedAt } }
  );

  return vendor;
}

export async function softDeletePurchaseOrder(
  poId: number,
  actor: string
) {
  const po = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { deletedAt: new Date() },
  });

  await recordAuditLog(
    "PurchaseOrder",
    poId,
    "Purchase Order Soft Deleted",
    actor,
    { newValue: { deletedAt: po.deletedAt } }
  );

  return po;
}

export async function softDeleteDocument(
  documentId: number,
  actor: string
) {
  const doc = await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });

  await recordAuditLog(
    "Document",
    documentId,
    "Invoice Soft Deleted",
    actor,
    { newValue: { deletedAt: doc.deletedAt } }
  );

  return doc;
}

export async function softDeleteContract(
  contractId: number,
  actor: string
) {
  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      deletedAt: new Date(),
      status: "TERMINATED",
    },
  });

  await recordAuditLog(
    "Contract",
    contractId,
    "Contract Soft Deleted",
    actor,
    { newValue: { deletedAt: contract.deletedAt } }
  );

  return contract;
}

export async function softDeletePayment(
  paymentId: number,
  actor: string
) {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { deletedAt: new Date() },
  });

  await recordAuditLog(
    "Payment",
    paymentId,
    "Payment Soft Deleted",
    actor,
    { newValue: { deletedAt: payment.deletedAt } }
  );

  return payment;
}
