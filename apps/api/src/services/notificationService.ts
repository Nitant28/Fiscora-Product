/**
 * Domain: Notifications — templated email queue (Resend), in-app alerts, and procurement lifecycle dispatchers.
 * Main exports: NOTIFICATION_EVENTS, renderTemplate, sendEmail, queueNotification, processNotificationQueue,
 *   sendNotification, notifyRequestSubmitted/Approved/Rejected, notifyRfqOpened/Awarded, notifyPoSent/Received,
 *   notifyInvoiceApproved, notifyPaymentDue/Completed, processContractExpiryNotifications, seedNotificationTemplatesIfEmpty.
 * Called by: server.ts, purchase-request.service.ts, rfq.service.ts, purchase-order.service.ts, goodsReceipt.ts,
 *   paymentEngine.ts, lib/seed.ts; scripts/verify-email-infrastructure.ts.
 */
import { Resend } from "resend";
import type { UserRole } from "@prisma/client";
import prisma from "../db";
import { APPROVER_ROLE_MAP } from "../lib/auth";
import {
  createNotification,
  notifyUsersByRoles,
} from "./notifications";
import { getExpiringContracts } from "./contractAlerts";

export const NOTIFICATION_EVENTS = {
  REQUEST_SUBMITTED: "REQUEST_SUBMITTED",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  REQUEST_APPROVED: "REQUEST_APPROVED",
  REQUEST_REJECTED: "REQUEST_REJECTED",
  RFQ_OPENED: "RFQ_OPENED",
  RFQ_AWARDED: "RFQ_AWARDED",
  PO_SENT: "PO_SENT",
  PO_RECEIVED: "PO_RECEIVED",
  INVOICE_APPROVED: "INVOICE_APPROVED",
  PAYMENT_DUE: "PAYMENT_DUE",
  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
  CONTRACT_90_DAY: "CONTRACT_90_DAY",
  CONTRACT_60_DAY: "CONTRACT_60_DAY",
  CONTRACT_30_DAY: "CONTRACT_30_DAY",
  CONTRACT_EXPIRED: "CONTRACT_EXPIRED",
} as const;

export type NotificationEvent =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

type TemplateVariables = Record<
  string,
  string | number | null | undefined
>;

const DEFAULT_FROM =
  process.env.RESEND_FROM_EMAIL ??
  "Fiscora <onboarding@resend.dev>";

let resendClient: Resend | null = null;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(
      process.env.RESEND_API_KEY
    );
  }

  return resendClient;
}

/* --- TEMPLATES & EMAIL --- */

export function renderTemplate(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => {
      const value = variables[key];
      return value == null
        ? ""
        : String(value);
    }
  );
}

function normalizeVariables(
  variables: TemplateVariables
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(variables).map(
      ([key, value]) => [
        key,
        value == null ? "" : String(value),
      ]
    )
  );
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
) {
  const client = getResendClient();

  if (!client) {
    console.log(
      `[email:skipped] ${to} — ${subject}`
    );
    return {
      id: "dev-skipped",
      skipped: true,
    };
  }

  const result = await client.emails.send({
    from: DEFAULT_FROM,
    to,
    subject,
    html: body.replace(/\n/g, "<br/>"),
    text: body,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function queueNotification(input: {
  event: NotificationEvent;
  recipientEmail: string;
  recipientUserId?: number;
  variables?: TemplateVariables;
  subject?: string;
  body?: string;
}) {
  const template =
    await prisma.notificationTemplate.findUnique(
      {
        where: { event: input.event },
      }
    );

  if (!template?.enabled) {
    return null;
  }

  const variables = normalizeVariables(
    input.variables ?? {}
  );
  const subject =
    input.subject ??
    renderTemplate(
      template.subject,
      variables
    );
  const body =
    input.body ??
    renderTemplate(template.body, variables);

  return prisma.notificationQueue.create({
    data: {
      event: input.event,
      recipientEmail: input.recipientEmail,
      recipientUserId:
        input.recipientUserId,
      subject,
      body,
      status: "PENDING",
    },
  });
}

export async function processNotificationQueue(
  limit = 25
) {
  const pending =
    await prisma.notificationQueue.findMany({
      where: {
        status: "PENDING",
        attempts: { lt: 5 },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

  let sent = 0;

  for (const item of pending) {
    try {
      await sendEmail(
        item.recipientEmail,
        item.subject,
        item.body
      );

      await prisma.notificationQueue.update({
        where: { id: item.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      sent += 1;
    } catch (error) {
      await prisma.notificationQueue.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
          lastError:
            error instanceof Error
              ? error.message
              : "Unknown email error",
        },
      });
    }
  }

  return { processed: pending.length, sent };
}

export async function sendNotification(input: {
  event: NotificationEvent;
  recipientEmail: string;
  recipientUserId?: number;
  variables?: TemplateVariables;
  inAppTitle?: string;
  inAppMessage?: string;
}) {
  if (
    input.recipientUserId &&
    input.inAppTitle &&
    input.inAppMessage
  ) {
    await createNotification(
      input.recipientUserId,
      input.inAppTitle,
      input.inAppMessage
    );
  }

  const queued = await queueNotification({
    event: input.event,
    recipientEmail:
      input.recipientEmail,
    recipientUserId:
      input.recipientUserId,
    variables: input.variables,
  });

  if (queued) {
    await processNotificationQueue();
  }

  return queued;
}

async function getUserEmail(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return user?.email ?? null;
}

async function getRoleEmails(roles: UserRole[]) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles } },
    select: { id: true, email: true },
  });

  return users.filter((user) =>
    Boolean(user.email)
  );
}

async function notifyRoles(
  roles: UserRole[],
  input: {
    event: NotificationEvent;
    variables?: TemplateVariables;
    inAppTitle: string;
    inAppMessage: string;
  }
) {
  const users = await getRoleEmails(roles);

  await notifyUsersByRoles(
    roles,
    input.inAppTitle,
    input.inAppMessage
  );

  for (const user of users) {
    await queueNotification({
      event: input.event,
      recipientEmail: user.email,
      recipientUserId: user.id,
      variables: input.variables,
    });
  }

  await processNotificationQueue();
}

async function markDispatched(
  event: NotificationEvent,
  entityType: string,
  entityId: number
) {
  try {
    await prisma.notificationDispatch.create({
      data: { event, entityType, entityId },
    });
    return true;
  } catch {
    return false;
  }
}

function formatMoney(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/* --- PROCUREMENT EVENT HANDLERS --- */

export async function notifyRequestSubmitted(
  request: {
    id: number;
    title: string;
    estimatedAmount: number;
    requester: string;
    requesterId?: number | null;
  }
) {
  const requesterEmail = request.requesterId
    ? await getUserEmail(request.requesterId)
    : null;

  const variables = {
    requestId: request.id,
    requestTitle: request.title,
    amount: formatMoney(
      request.estimatedAmount
    ),
    requester: request.requester,
  };

  if (requesterEmail) {
    await sendNotification({
      event:
        NOTIFICATION_EVENTS.REQUEST_SUBMITTED,
      recipientEmail: requesterEmail,
      recipientUserId:
        request.requesterId ?? undefined,
      variables,
      inAppTitle: "Request submitted",
      inAppMessage: `${request.title} was submitted for approval`,
    });
  }
}

export async function notifyApprovalRequiredEmail(
  request: {
    id: number;
    title: string;
    estimatedAmount: number;
  },
  approverTitle: string
) {
  const roles =
    APPROVER_ROLE_MAP[approverTitle] ?? [
      "ADMIN" as UserRole,
    ];

  await notifyRoles(roles, {
    event:
      NOTIFICATION_EVENTS.APPROVAL_REQUIRED,
    variables: {
      requestId: request.id,
      requestTitle: request.title,
      amount: formatMoney(
        request.estimatedAmount
      ),
      approver: approverTitle,
    },
    inAppTitle: "Approval required",
    inAppMessage: `${request.title} (${formatMoney(request.estimatedAmount)}) awaits approval`,
  });
}

export async function notifyRequestApproved(
  request: {
    id: number;
    title: string;
    estimatedAmount: number;
    requester: string;
    requesterId?: number | null;
  },
  approvedBy: string
) {
  const requesterEmail = request.requesterId
    ? await getUserEmail(request.requesterId)
    : null;

  if (!requesterEmail) {
    return;
  }

  await sendNotification({
    event:
      NOTIFICATION_EVENTS.REQUEST_APPROVED,
    recipientEmail: requesterEmail,
    recipientUserId:
      request.requesterId ?? undefined,
    variables: {
      requestId: request.id,
      requestTitle: request.title,
      amount: formatMoney(
        request.estimatedAmount
      ),
      approvedBy,
    },
    inAppTitle: "Request approved",
    inAppMessage: `${request.title} was approved by ${approvedBy}`,
  });
}

export async function notifyRequestRejected(
  request: {
    id: number;
    title: string;
    requester: string;
    requesterId?: number | null;
  },
  rejectedBy: string
) {
  const requesterEmail = request.requesterId
    ? await getUserEmail(request.requesterId)
    : null;

  if (!requesterEmail) {
    return;
  }

  await sendNotification({
    event:
      NOTIFICATION_EVENTS.REQUEST_REJECTED,
    recipientEmail: requesterEmail,
    recipientUserId:
      request.requesterId ?? undefined,
    variables: {
      requestId: request.id,
      requestTitle: request.title,
      rejectedBy,
    },
    inAppTitle: "Request rejected",
    inAppMessage: `${request.title} was rejected by ${rejectedBy}`,
  });
}

export async function notifyRfqOpened(
  rfq: { id: number; title: string },
  actor: string
) {
  await notifyRoles(["PROCUREMENT", "ADMIN"], {
    event: NOTIFICATION_EVENTS.RFQ_OPENED,
    variables: {
      rfqId: rfq.id,
      rfqTitle: rfq.title,
      actor,
    },
    inAppTitle: "RFQ opened",
    inAppMessage: `${rfq.title} is now open for bids`,
  });
}

export async function notifyRfqAwarded(
  rfq: {
    id: number;
    title: string;
  },
  vendor: { name: string; email?: string | null },
  awardedBy: string
) {
  await notifyRoles(
    ["PROCUREMENT", "CFO", "ADMIN"],
    {
      event:
        NOTIFICATION_EVENTS.RFQ_AWARDED,
      variables: {
        rfqId: rfq.id,
        rfqTitle: rfq.title,
        vendorName: vendor.name,
        awardedBy,
      },
      inAppTitle: "RFQ awarded",
      inAppMessage: `${rfq.title} awarded to ${vendor.name}`,
    }
  );

  if (vendor.email) {
    await sendNotification({
      event:
        NOTIFICATION_EVENTS.RFQ_AWARDED,
      recipientEmail: vendor.email,
      variables: {
        rfqId: rfq.id,
        rfqTitle: rfq.title,
        vendorName: vendor.name,
        awardedBy,
      },
    });
  }
}

export async function notifyPoSent(
  po: {
    id: number;
    poNumber: string;
    vendorName: string;
    amount: number;
  },
  actor: string
) {
  const vendor = await prisma.vendor.findFirst({
    where: {
      name: {
        equals: po.vendorName,
        mode: "insensitive",
      },
    },
    select: { email: true },
  });

  await notifyRoles(["PROCUREMENT", "ADMIN"], {
    event: NOTIFICATION_EVENTS.PO_SENT,
    variables: {
      poId: po.id,
      poNumber: po.poNumber,
      vendorName: po.vendorName,
      amount: formatMoney(po.amount),
      actor,
    },
    inAppTitle: "PO sent",
    inAppMessage: `${po.poNumber} sent to ${po.vendorName}`,
  });

  if (vendor?.email) {
    await sendNotification({
      event: NOTIFICATION_EVENTS.PO_SENT,
      recipientEmail: vendor.email,
      variables: {
        poId: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        amount: formatMoney(po.amount),
        actor,
      },
    });
  }
}

export async function notifyPoReceived(
  po: {
    id: number;
    poNumber: string;
    vendorName: string;
    quantityReceived: number;
  },
  receiverName: string
) {
  await notifyRoles(
    ["PROCUREMENT", "CFO", "ADMIN"],
    {
      event:
        NOTIFICATION_EVENTS.PO_RECEIVED,
      variables: {
        poId: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        quantityReceived:
          po.quantityReceived,
        receiverName,
      },
      inAppTitle: "Goods received",
      inAppMessage: `${po.poNumber}: ${po.quantityReceived} units received`,
    }
  );
}

export async function notifyInvoiceApproved(
  invoice: {
    id: number;
    invoiceNumber: string | null;
    vendorName: string | null;
    totalAmount: number | null;
  },
  approvedBy: string
) {
  await notifyRoles(["CFO", "ADMIN"], {
    event:
      NOTIFICATION_EVENTS.INVOICE_APPROVED,
    variables: {
      invoiceId: invoice.id,
      invoiceNumber:
        invoice.invoiceNumber ??
        `INV-${invoice.id}`,
      vendorName:
        invoice.vendorName ?? "Unknown",
      amount: formatMoney(
        invoice.totalAmount ?? 0
      ),
      approvedBy,
    },
    inAppTitle: "Invoice approved",
    inAppMessage: `${invoice.invoiceNumber ?? invoice.id} approved for payment`,
  });
}

export async function notifyPaymentDue(
  payment: {
    id: number;
    amount: number;
    dueDate: Date;
    vendorName: string;
    invoiceNumber: string;
  }
) {
  const shouldSend = await markDispatched(
    NOTIFICATION_EVENTS.PAYMENT_DUE,
    "Payment",
    payment.id
  );

  if (!shouldSend) {
    return;
  }

  await notifyRoles(["CFO", "ADMIN"], {
    event: NOTIFICATION_EVENTS.PAYMENT_DUE,
    variables: {
      paymentId: payment.id,
      vendorName: payment.vendorName,
      invoiceNumber: payment.invoiceNumber,
      amount: formatMoney(payment.amount),
      dueDate:
        payment.dueDate.toLocaleDateString(
          "en-IN"
        ),
    },
    inAppTitle: "Payment due",
    inAppMessage: `${formatMoney(payment.amount)} due for ${payment.vendorName}`,
  });
}

export async function notifyPaymentCompleted(
  payment: {
    id: number;
    amount: number;
    vendorName: string;
    invoiceNumber: string;
  },
  actor: string
) {
  await notifyRoles(["CFO", "ADMIN"], {
    event:
      NOTIFICATION_EVENTS.PAYMENT_COMPLETED,
    variables: {
      paymentId: payment.id,
      vendorName: payment.vendorName,
      invoiceNumber: payment.invoiceNumber,
      amount: formatMoney(payment.amount),
      actor,
    },
    inAppTitle: "Payment completed",
    inAppMessage: `${formatMoney(payment.amount)} paid to ${payment.vendorName}`,
  });
}

function contractEventForDays(
  daysRemaining: number
): NotificationEvent | null {
  if (daysRemaining <= 0) {
    return NOTIFICATION_EVENTS.CONTRACT_EXPIRED;
  }

  if (daysRemaining <= 30) {
    return NOTIFICATION_EVENTS.CONTRACT_30_DAY;
  }

  if (daysRemaining <= 60) {
    return NOTIFICATION_EVENTS.CONTRACT_60_DAY;
  }

  if (daysRemaining <= 90) {
    return NOTIFICATION_EVENTS.CONTRACT_90_DAY;
  }

  return null;
}

/* --- CONTRACT & SEED --- */

export async function processContractExpiryNotifications(
  asOf = new Date()
) {
  const alerts =
    await getExpiringContracts(asOf);

  for (const alert of alerts) {
    const event = contractEventForDays(
      alert.daysRemaining
    );

    if (!event) {
      continue;
    }

    const shouldSend = await markDispatched(
      event,
      "Contract",
      alert.id
    );

    if (!shouldSend) {
      continue;
    }

    await notifyRoles(
      ["PROCUREMENT", "CFO", "ADMIN"],
      {
        event,
        variables: {
          contractId: alert.id,
          contractTitle: alert.title,
          vendorName: alert.vendorName,
          daysRemaining: alert.daysRemaining,
          endDate:
            alert.endDate.toLocaleDateString(
              "en-IN"
            ),
          severity: alert.severity,
        },
        inAppTitle: "Contract expiry alert",
        inAppMessage: `${alert.title} expires in ${alert.daysRemaining} days`,
      }
    );
  }
}

export async function seedNotificationTemplatesIfEmpty() {
  const count =
    await prisma.notificationTemplate.count();

  if (count > 0) {
    return;
  }

  const templates: Array<{
    event: NotificationEvent;
    subject: string;
    body: string;
  }> = [
    {
      event:
        NOTIFICATION_EVENTS.REQUEST_SUBMITTED,
      subject:
        "Request submitted: {{requestTitle}}",
      body: "Hello {{requester}},\n\nYour purchase request \"{{requestTitle}}\" ({{amount}}) has been submitted and is awaiting approval.\n\n— Fiscora",
    },
    {
      event:
        NOTIFICATION_EVENTS.APPROVAL_REQUIRED,
      subject:
        "Approval required: {{requestTitle}}",
      body: "A purchase request requires your approval.\n\nRequest: {{requestTitle}}\nAmount: {{amount}}\nApprover role: {{approver}}\n\nPlease review in Fiscora.\n\n— Fiscora",
    },
    {
      event:
        NOTIFICATION_EVENTS.REQUEST_APPROVED,
      subject:
        "Approved: {{requestTitle}}",
      body: "Your request \"{{requestTitle}}\" ({{amount}}) was approved by {{approvedBy}}.\n\n— Fiscora",
    },
    {
      event:
        NOTIFICATION_EVENTS.REQUEST_REJECTED,
      subject:
        "Rejected: {{requestTitle}}",
      body: "Your request \"{{requestTitle}}\" was rejected by {{rejectedBy}}.\n\n— Fiscora",
    },
    {
      event: NOTIFICATION_EVENTS.RFQ_OPENED,
      subject: "RFQ opened: {{rfqTitle}}",
      body: "RFQ \"{{rfqTitle}}\" is now open for vendor bids.\n\nOpened by {{actor}}.\n\n— Fiscora",
    },
    {
      event: NOTIFICATION_EVENTS.RFQ_AWARDED,
      subject:
        "RFQ awarded: {{rfqTitle}}",
      body: "RFQ \"{{rfqTitle}}\" was awarded to {{vendorName}} by {{awardedBy}}.\n\n— Fiscora",
    },
    {
      event: NOTIFICATION_EVENTS.PO_SENT,
      subject: "PO sent: {{poNumber}}",
      body: "Purchase order {{poNumber}} for {{amount}} was sent to {{vendorName}} by {{actor}}.\n\n— Fiscora",
    },
    {
      event: NOTIFICATION_EVENTS.PO_RECEIVED,
      subject:
        "Goods received: {{poNumber}}",
      body: "{{quantityReceived}} units received against PO {{poNumber}} from {{vendorName}}. Recorded by {{receiverName}}.\n\n— Fiscora",
    },
    {
      event:
        NOTIFICATION_EVENTS.INVOICE_APPROVED,
      subject:
        "Invoice approved: {{invoiceNumber}}",
      body: "Invoice {{invoiceNumber}} from {{vendorName}} ({{amount}}) was approved by {{approvedBy}} and is ready for payment scheduling.\n\n— Fiscora",
    },
    {
      event: NOTIFICATION_EVENTS.PAYMENT_DUE,
      subject:
        "Payment due: {{invoiceNumber}}",
      body: "Payment of {{amount}} to {{vendorName}} for invoice {{invoiceNumber}} is due on {{dueDate}}.\n\n— Fiscora",
    },
    {
      event:
        NOTIFICATION_EVENTS.PAYMENT_COMPLETED,
      subject:
        "Payment completed: {{invoiceNumber}}",
      body: "Payment of {{amount}} to {{vendorName}} for invoice {{invoiceNumber}} was completed by {{actor}}.\n\n— Fiscora",
    },
    {
      event:
        NOTIFICATION_EVENTS.CONTRACT_90_DAY,
      subject:
        "Contract expiring in 90 days: {{contractTitle}}",
      body: "Contract \"{{contractTitle}}\" with {{vendorName}} expires on {{endDate}} ({{daysRemaining}} days remaining).\n\n— Fiscora",
    },
    {
      event:
        NOTIFICATION_EVENTS.CONTRACT_60_DAY,
      subject:
        "Contract expiring in 60 days: {{contractTitle}}",
      body: "WARNING: Contract \"{{contractTitle}}\" with {{vendorName}} expires on {{endDate}} ({{daysRemaining}} days remaining).\n\n— Fiscora",
    },
    {
      event:
        NOTIFICATION_EVENTS.CONTRACT_30_DAY,
      subject:
        "CRITICAL — Contract expiring in 30 days: {{contractTitle}}",
      body: "CRITICAL: Contract \"{{contractTitle}}\" with {{vendorName}} expires on {{endDate}} ({{daysRemaining}} days remaining). Renewal action required.\n\n— Fiscora",
    },
    {
      event:
        NOTIFICATION_EVENTS.CONTRACT_EXPIRED,
      subject:
        "Contract expired: {{contractTitle}}",
      body: "Contract \"{{contractTitle}}\" with {{vendorName}} has expired as of {{endDate}}.\n\n— Fiscora",
    },
  ];

  await prisma.notificationTemplate.createMany({
    data: templates,
  });
}
