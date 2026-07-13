import prisma from "../../db";
import {
  type AuditActorContext,
  recordAuditLog,
  resolveApprover,
} from "../../lib/audit";
import { determineApprover } from "../../services/approvalMatrix";
import { checkBudget } from "../departments/department.service";
import {
  assignSlaOnRequest,
} from "../../services/slaEngine";
import {
  commitBudget,
  releaseBudget,
  reserveBudget,
} from "../../services/budgetEngine";
import { notifyApprovalRequired } from "../../services/notifications";
import {
  notifyRequestApproved,
  notifyRequestRejected,
  notifyRequestSubmitted,
} from "../../services/notificationService";
import { sendPurchaseRequestApprovalEmails } from "../email-approvals/email-approval.service";
import { getSpendCategory } from "../../services/spendCategories";
import { evaluateSplitPurchaseOnCreate } from "../../services/splitPurchaseFraud";
import type { CreatePurchaseRequestInput } from "./purchase-request.types";

export async function createRequest(
  input: CreatePurchaseRequestInput & {
    actorContext?: AuditActorContext;
  }
) {
  const spendCategory =
    await getSpendCategory(input.categoryId);

  if (!spendCategory?.active) {
    throw new Error("Invalid spend category");
  }

  if (input.departmentId) {
    const budgetCheck =
      await checkBudget(
        input.departmentId,
        input.estimatedAmount
      );

    if (!budgetCheck.allowed) {
      const blocked =
        await prisma.purchaseRequest.create({
          data: {
            title: input.title,
            vendorName: input.vendorName,
            estimatedAmount:
              input.estimatedAmount,
            description:
              input.description ?? null,
            category: spendCategory.name,
            categoryId: spendCategory.id,
            requester: input.requester,
            requesterId:
              input.requesterId ?? null,
            departmentId:
              input.departmentId,
            status: "BUDGET_EXCEEDED",
          },
        });

      await recordAuditLog(
        "PurchaseRequest",
        blocked.id,
        "Budget Alert",
        input.requester,
        {
          newValue: {
            message:
              budgetCheck.message,
          },
          metadata: budgetCheck.department,
          actorContext: input.actorContext,
        }
      );

      throw new Error(
        budgetCheck.message ??
          "Budget exceeded"
      );
    }
  }

  const request =
    await prisma.purchaseRequest.create({
      data: {
        title: input.title,
        vendorName: input.vendorName,
        estimatedAmount:
          input.estimatedAmount,
        description:
          input.description ?? null,
        category: spendCategory.name,
        categoryId: spendCategory.id,
        requester: input.requester,
        requesterId:
          input.requesterId ?? null,
        departmentId:
          input.departmentId ?? null,
        status: "SUBMITTED",
      },
      include: { department: true },
    });

  if (input.departmentId) {
    await reserveBudget(
      input.departmentId,
      input.estimatedAmount,
      input.requester,
      request.id
    );
  }

  await recordAuditLog(
    "PurchaseRequest",
    request.id,
    "Request Created",
    input.requester,
    {
      newValue: {
        title: request.title,
        amount: request.estimatedAmount,
        department:
          request.department?.name,
      },
      actorContext: input.actorContext,
    }
  );

  const decision = await determineApprover(
    request.estimatedAmount,
    request.department?.name ?? null,
    request.category ?? null
  );
  const approver = decision.approver;

  await recordAuditLog(
    "PurchaseRequest",
    request.id,
    "REQUEST_APPROVER_ASSIGNED",
    input.requester,
    {
      newValue: {
        ruleId: decision.ruleId,
        approverRole: decision.role,
        approver,
      },
      actorContext: input.actorContext,
    }
  );

  await assignSlaOnRequest(
    request.id,
    approver
  );

  await notifyApprovalRequired(
    request.id,
    request.title,
    request.estimatedAmount,
    approver
  );

  void notifyRequestSubmitted({
    id: request.id,
    title: request.title,
    estimatedAmount: request.estimatedAmount,
    requester: request.requester,
    requesterId: request.requesterId,
  }).catch(console.error);

  void sendPurchaseRequestApprovalEmails(
    {
      id: request.id,
      title: request.title,
      estimatedAmount: request.estimatedAmount,
      requester: request.requester,
      department: request.department?.name,
    },
    approver
  ).catch(console.error);

  await evaluateSplitPurchaseOnCreate(
    request,
    input.requester
  );

  return request;
}

export async function listRequests() {
  return prisma.purchaseRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      department: true,
      spendCategory: true,
    },
  });
}

export async function getRequest(id: number) {
  return prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      department: true,
      spendCategory: true,
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function approveRequest(
  id: number,
  approvedBy: string,
  actorContext?: AuditActorContext
) {
  const existing =
    await prisma.purchaseRequest.findUnique({
      where: { id },
      include: { department: true },
    });

  if (!existing) {
    throw new Error("Request not found");
  }

  if (
    existing.departmentId &&
    existing.status === "SUBMITTED"
  ) {
    await commitBudget(
      existing.departmentId,
      existing.estimatedAmount,
      approvedBy,
      id
    );
  }

  const request =
    await prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy,
        approvedAt: new Date(),
      },
      include: { department: true },
    });

  await recordAuditLog(
    "PurchaseRequest",
    id,
    "Request Approved",
    approvedBy,
    {
      oldValue: { status: existing.status },
      newValue: { status: "APPROVED" },
      actorContext,
    }
  );

  void notifyRequestApproved(
    {
      id: request.id,
      title: request.title,
      estimatedAmount: request.estimatedAmount,
      requester: request.requester,
      requesterId: request.requesterId,
    },
    approvedBy
  ).catch(console.error);

  return request;
}

export async function rejectRequest(
  id: number,
  rejectedBy: string,
  actorContext?: AuditActorContext
) {
  const existing =
    await prisma.purchaseRequest.findUnique({
      where: { id },
    });

  if (
    existing?.departmentId &&
    existing.status === "SUBMITTED"
  ) {
    await releaseBudget(
      existing.departmentId,
      existing.estimatedAmount,
      rejectedBy,
      id
    );
  }

  const request =
    await prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedBy: rejectedBy,
        approvedAt: new Date(),
      },
    });

  await recordAuditLog(
    "PurchaseRequest",
    id,
    "Request Rejected",
    rejectedBy,
    {
      oldValue: {
        status: existing?.status,
      },
      newValue: { status: "REJECTED" },
      actorContext,
    }
  );

  void notifyRequestRejected(
    {
      id: request.id,
      title: request.title,
      requester: request.requester,
      requesterId: request.requesterId,
    },
    rejectedBy
  ).catch(console.error);

  return request;
}

export { resolveApprover };
