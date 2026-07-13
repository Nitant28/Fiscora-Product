/**
 * Domain: Email approvals — one-click approve/reject from email without login.
 */
import crypto from "crypto";
import type { UserRole } from "@prisma/client";
import prisma from "../../db";
import { APPROVER_ROLE_MAP } from "../../lib/auth";
import { recordAuditLog } from "../../lib/audit";
import { getRequestId } from "../../lib/requestContext";
import {
  approveRequest,
  rejectRequest,
} from "../purchase-requests/purchase-request.service";
import { notifyUsersByRoles } from "../../services/notifications";

const TOKEN_DAYS = 7;

const WEB_BASE =
  process.env.FISCORA_WEB_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

export type EmailApprovalAction = "APPROVE" | "REJECT";

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function formatPrNumber(id: number) {
  return `PR-${String(id).padStart(3, "0")}`;
}

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function tokenExpiry() {
  const expires = new Date();
  expires.setDate(expires.getDate() + TOKEN_DAYS);
  return expires;
}

async function createTokenPair(input: {
  approvalId: string;
  recipientUserId: number;
  recipientEmail: string;
}) {
  const expiresAt = tokenExpiry();
  const approveToken = newToken();
  const rejectToken = newToken();

  await prisma.approvalToken.createMany({
    data: [
      {
        token: approveToken,
        approvalId: input.approvalId,
        action: "APPROVE",
        recipientUserId: input.recipientUserId,
        recipientEmail: input.recipientEmail,
        expiresAt,
      },
      {
        token: rejectToken,
        approvalId: input.approvalId,
        action: "REJECT",
        recipientUserId: input.recipientUserId,
        recipientEmail: input.recipientEmail,
        expiresAt,
      },
    ],
  });

  return { approveToken, rejectToken, expiresAt };
}

function buildApprovalEmailHtml(input: {
  prNumber: string;
  title: string;
  amount: string;
  requester: string;
  department: string;
  approveUrl: string;
  rejectUrl: string;
}) {
  return `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 8px">Approval Required</h2>
  <p style="color:#555;margin:0 0 24px">Purchase Request ${input.prNumber}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <tr><td style="padding:8px 0;color:#666">Amount</td><td style="padding:8px 0;font-weight:600">${input.amount}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Requester</td><td style="padding:8px 0">${input.requester}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Department</td><td style="padding:8px 0">${input.department}</td></tr>
  </table>
  <p style="margin-bottom:16px">
    <a href="${input.approveUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:12px">Approve</a>
    <a href="${input.rejectUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Reject</a>
  </p>
  <p style="color:#888;font-size:12px">Links expire in ${TOKEN_DAYS} days. Audit trail recorded as EMAIL_APPROVAL.</p>
  <p style="color:#888;font-size:12px">— Fiscora Spend Governance</p>
</div>`;
}

export async function sendPurchaseRequestApprovalEmails(
  request: {
    id: number;
    title: string;
    estimatedAmount: number;
    requester: string;
    department?: string | null;
  },
  approverTitle: string
) {
  const roles =
    APPROVER_ROLE_MAP[approverTitle] ?? [
      "ADMIN" as UserRole,
    ];

  const users = await prisma.user.findMany({
    where: { role: { in: roles } },
    select: { id: true, email: true, name: true },
  });

  await notifyUsersByRoles(
    roles,
    "Approval required",
    `${request.title} (${formatInr(request.estimatedAmount)}) awaits your approval`
  );

  const prNumber = formatPrNumber(request.id);
  const approvalId = String(request.id);
  const amount = formatInr(request.estimatedAmount);
  const department = request.department ?? "—";

  for (const user of users) {
    if (!user.email) continue;

    const { approveToken, rejectToken } =
      await createTokenPair({
        approvalId,
        recipientUserId: user.id,
        recipientEmail: user.email,
      });

    const approveUrl = `${WEB_BASE}/email-approvals/approve/${approveToken}`;
    const rejectUrl = `${WEB_BASE}/email-approvals/reject/${rejectToken}`;

    const html = buildApprovalEmailHtml({
      prNumber,
      title: request.title,
      amount,
      requester: request.requester,
      department,
      approveUrl,
      rejectUrl,
    });

    const text = [
      `Purchase Request ${prNumber}`,
      `Amount: ${amount}`,
      `Requester: ${request.requester}`,
      `Department: ${department}`,
      "",
      `Approve: ${approveUrl}`,
      `Reject: ${rejectUrl}`,
    ].join("\n");

    await sendApprovalHtmlEmail(
      user.email,
      `Approval required: ${request.title}`,
      html,
      text
    );
  }
}

async function sendApprovalHtmlEmail(
  to: string,
  subject: string,
  html: string,
  text: string
) {
  const resendKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ??
    "Fiscora <onboarding@resend.dev>";

  if (!resendKey) {
    console.log(`[email-approval:skipped] ${to} — ${subject}`);
    console.log(text);
    return;
  }

  const { Resend } = await import("resend");
  const client = new Resend(resendKey);
  await client.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });
}

async function validateToken(
  token: string,
  expectedAction: EmailApprovalAction
) {
  const record = await prisma.approvalToken.findUnique({
    where: { token },
  });

  if (!record) {
    throw new Error("Invalid or unknown approval link");
  }

  if (record.action !== expectedAction) {
    throw new Error("This link does not match the requested action");
  }

  if (record.usedAt) {
    throw new Error("This approval link has already been used");
  }

  if (record.expiresAt < new Date()) {
    throw new Error("This approval link has expired");
  }

  return record;
}

async function invalidateSiblingTokens(
  approvalId: string,
  recipientUserId: number | null
) {
  await prisma.approvalToken.updateMany({
    where: {
      approvalId,
      recipientUserId: recipientUserId ?? undefined,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });
}

async function recordEmailApprovalAudit(input: {
  requestId: number;
  action: EmailApprovalAction;
  actorEmail: string | null;
  tokenId: string;
}) {
  await recordAuditLog(
    "PurchaseRequest",
    input.requestId,
    "EMAIL_APPROVAL",
    input.actorEmail ?? "Email Approval",
    {
      newValue: {
        action: input.action,
        channel: "email",
        tokenId: input.tokenId,
        requestId: getRequestId(),
      },
      metadata: {
        emailApproval: true,
      },
    }
  );
}

export async function getEmailApprovalPreview(token: string) {
  const record = await prisma.approvalToken.findUnique({
    where: { token },
  });

  if (!record) {
    return null;
  }

  const requestId = Number(record.approvalId);

  if (!Number.isFinite(requestId)) {
    return null;
  }

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: requestId },
    include: { department: true },
  });

  if (!request) {
    return null;
  }

  return {
    token: record.token,
    action: record.action,
    expired: record.expiresAt < new Date(),
    used: Boolean(record.usedAt),
    request: {
      id: request.id,
      prNumber: formatPrNumber(request.id),
      title: request.title,
      amount: formatInr(request.estimatedAmount),
      amountRaw: request.estimatedAmount,
      requester: request.requester,
      department: request.department?.name ?? "—",
      status: request.status,
    },
  };
}

export async function approveViaEmailToken(token: string) {
  const record = await validateToken(token, "APPROVE");
  const requestId = Number(record.approvalId);

  if (!Number.isFinite(requestId)) {
    throw new Error("Invalid approval reference");
  }

  const existing = await prisma.purchaseRequest.findUnique({
    where: { id: requestId },
  });

  if (!existing) {
    throw new Error("Purchase request not found");
  }

  if (existing.status !== "SUBMITTED") {
    throw new Error(
      `Request is already ${existing.status.toLowerCase()}`
    );
  }

  const actor =
    record.recipientEmail ?? "Email Approval";

  const request = await approveRequest(
    requestId,
    actor
  );

  await prisma.approvalToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  await invalidateSiblingTokens(
    record.approvalId,
    record.recipientUserId
  );

  await recordEmailApprovalAudit({
    requestId,
    action: "APPROVE",
    actorEmail: record.recipientEmail,
    tokenId: record.id,
  });

  return {
    success: true,
    action: "APPROVE" as const,
    request,
    prNumber: formatPrNumber(requestId),
  };
}

export async function rejectViaEmailToken(token: string) {
  const record = await validateToken(token, "REJECT");
  const requestId = Number(record.approvalId);

  if (!Number.isFinite(requestId)) {
    throw new Error("Invalid approval reference");
  }

  const existing = await prisma.purchaseRequest.findUnique({
    where: { id: requestId },
  });

  if (!existing) {
    throw new Error("Purchase request not found");
  }

  if (existing.status !== "SUBMITTED") {
    throw new Error(
      `Request is already ${existing.status.toLowerCase()}`
    );
  }

  const actor =
    record.recipientEmail ?? "Email Approval";

  const request = await rejectRequest(
    requestId,
    actor
  );

  await prisma.approvalToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  await invalidateSiblingTokens(
    record.approvalId,
    record.recipientUserId
  );

  await recordEmailApprovalAudit({
    requestId,
    action: "REJECT",
    actorEmail: record.recipientEmail,
    tokenId: record.id,
  });

  return {
    success: true,
    action: "REJECT" as const,
    request,
    prNumber: formatPrNumber(requestId),
  };
}
