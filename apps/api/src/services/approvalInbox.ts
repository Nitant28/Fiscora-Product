/**
 * Domain: Approvals — unified inbox for purchase requests and invoices awaiting action.
 * Main exports: getApprovalInboxForUser, getApprovalInbox (deprecated).
 * Called by: server.ts (GET approval inbox API).
 */
import prisma from "../db";
import {
  canApprove,
  getApproverTitlesForRole,
} from "../lib/auth";
import type { UserRole } from "@prisma/client";

export async function getApprovalInboxForUser(
  role: UserRole
) {
  const titles =
    getApproverTitlesForRole(role);

  const submitted =
    await prisma.purchaseRequest.findMany({
      where: { status: "SUBMITTED" },
      include: { department: true },
      orderBy: { createdAt: "desc" },
    });

  const requests = submitted.filter((req) =>
    canApprove(
      role,
      req.assignedApprover
    )
  );

  const invoices =
    await prisma.document.findMany({
      where: { status: "processed" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        invoiceNumber: true,
        vendorName: true,
        totalAmount: true,
        createdAt: true,
      },
    });

  return { requests, invoices, approverTitles: titles };
}

/* --- LEGACY INBOX --- */

/** @deprecated use getApprovalInboxForUser */
export async function getApprovalInbox(
  approver: string
) {
  const submitted =
    await prisma.purchaseRequest.findMany({
      where: {
        status: "SUBMITTED",
        assignedApprover: approver,
      },
      include: { department: true },
      orderBy: { createdAt: "desc" },
    });

  const invoices =
    await prisma.document.findMany({
      where: { status: "processed" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        invoiceNumber: true,
        vendorName: true,
        totalAmount: true,
        createdAt: true,
      },
    });

  return { requests: submitted, invoices };
}
