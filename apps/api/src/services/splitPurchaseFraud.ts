/**
 * Domain: Policy compliance — split-purchase / approval-bypass detection across clustered requests.
 * Main exports: evaluateCombinedSpend, findSplitPurchaseCluster, getSplitPurchaseRiskForRequest,
 *   evaluateSplitPurchaseOnCreate, getSplitPurchaseAlertCount, getSplitPurchaseAlerts, getPolicyViolationSummary.
 * Called by: purchase-request.service.ts, purchase-request.controller.ts, executiveAnalytics.ts, controlTower.ts;
 *   scripts/verify-split-purchase-fraud.ts.
 */
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";

export const MANAGER_LIMIT = 50000;
export const DIRECTOR_LIMIT = 200000;
export const SPLIT_PURCHASE_WINDOW_DAYS = 7;
export const MIN_CLUSTER_REQUESTS = 2;

export type SplitPurchaseCluster = {
  requestIds: number[];
  requestCount: number;
  combinedSpend: number;
  exceededLimit: number;
  limitLabel: string;
  windowDays: number;
  requester: string;
  department: string | null;
  category: string | null;
  vendorName: string | null;
  requests: Array<{
    id: number;
    title: string;
    estimatedAmount: number;
    createdAt: Date;
  }>;
};

type ClusterInput = {
  requestId: number;
  requester: string;
  requesterId?: number | null;
  departmentId?: number | null;
  category?: string | null;
  categoryId?: number | null;
  vendorName?: string | null;
  asOf?: Date;
};

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function buildRequesterFilter(input: ClusterInput) {
  if (input.requesterId != null) {
    return { requesterId: input.requesterId };
  }

  return {
    requester: input.requester,
  };
}

export function evaluateCombinedSpend(
  combinedSpend: number,
  requestCount: number,
  requests: Array<{ estimatedAmount: number }>
): Omit<
  SplitPurchaseCluster,
  | "requestIds"
  | "requestCount"
  | "combinedSpend"
  | "requests"
  | "requester"
  | "department"
  | "category"
  | "vendorName"
  | "windowDays"
> | null {
  if (requestCount < MIN_CLUSTER_REQUESTS) {
    return null;
  }

  const eachBelowManagerLimit =
    requests.every(
      (request) =>
        request.estimatedAmount <=
        MANAGER_LIMIT
    );

  if (
    eachBelowManagerLimit &&
    combinedSpend > MANAGER_LIMIT
  ) {
    return {
      exceededLimit: MANAGER_LIMIT,
      limitLabel: "Manager",
    };
  }

  const eachBelowDirectorLimit =
    requests.every(
      (request) =>
        request.estimatedAmount <=
        DIRECTOR_LIMIT
    );

  if (
    eachBelowDirectorLimit &&
    combinedSpend > DIRECTOR_LIMIT
  ) {
    return {
      exceededLimit: DIRECTOR_LIMIT,
      limitLabel: "Director",
    };
  }

  return null;
}

/* --- CLUSTER DETECTION --- */

export async function findSplitPurchaseCluster(
  input: ClusterInput
): Promise<SplitPurchaseCluster | null> {
  const asOf = input.asOf ?? new Date();
  const windowStart = addDays(
    asOf,
    SPLIT_PURCHASE_WINDOW_DAYS
  );

  if (
    input.departmentId == null ||
    !input.category?.trim()
  ) {
    return null;
  }

  const vendorName = input.vendorName?.trim();

  if (!vendorName) {
    return null;
  }

  const related =
    await prisma.purchaseRequest.findMany({
      where: {
        ...buildRequesterFilter(input),
        departmentId: input.departmentId,
        category: input.category,
        vendorName: {
          equals: vendorName,
          mode: "insensitive",
        },
        createdAt: { gte: windowStart },
        status: {
          in: [
            "SUBMITTED",
            "APPROVED",
            "CONVERTED_TO_PO",
          ],
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        estimatedAmount: true,
        createdAt: true,
        requester: true,
        category: true,
        vendorName: true,
        department: {
          select: { name: true },
        },
      },
    });

  if (related.length < MIN_CLUSTER_REQUESTS) {
    return null;
  }

  const combinedSpend = related.reduce(
    (sum, request) =>
      sum + request.estimatedAmount,
    0
  );

  const threshold = evaluateCombinedSpend(
    combinedSpend,
    related.length,
    related
  );

  if (!threshold) {
    return null;
  }

  return {
    requestIds: related.map(
      (request) => request.id
    ),
    requestCount: related.length,
    combinedSpend,
    exceededLimit: threshold.exceededLimit,
    limitLabel: threshold.limitLabel,
    windowDays: SPLIT_PURCHASE_WINDOW_DAYS,
    requester: input.requester,
    department:
      related[0]?.department?.name ?? null,
    category: input.category,
    vendorName,
    requests: related,
  };
}

export async function getSplitPurchaseRiskForRequest(
  requestId: number
): Promise<SplitPurchaseCluster | null> {
  const request =
    await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      include: {
        department: true,
      },
    });

  if (!request) {
    return null;
  }

  return findSplitPurchaseCluster({
    requestId: request.id,
    requester: request.requester,
    requesterId: request.requesterId,
    departmentId: request.departmentId,
    category: request.category,
    categoryId: request.categoryId,
    vendorName: request.vendorName,
  });
}

async function upsertSplitPurchaseFlag(
  requestId: number,
  cluster: SplitPurchaseCluster
) {
  const existing =
    await prisma.purchaseRequestFlag.findFirst({
      where: {
        requestId,
        type: "SPLIT_PURCHASE_RISK",
        resolved: false,
      },
    });

  const message = `Potential approval bypass: ${cluster.requestCount} requests totalling ₹${cluster.combinedSpend.toLocaleString("en-IN")} within ${cluster.windowDays} days (exceeds ${cluster.limitLabel} limit of ₹${cluster.exceededLimit.toLocaleString("en-IN")})`;

  if (existing) {
    await prisma.purchaseRequestFlag.update({
      where: { id: existing.id },
      data: {
        message,
        metadata: {
          requestIds: cluster.requestIds,
          combinedSpend:
            cluster.combinedSpend,
          exceededLimit:
            cluster.exceededLimit,
        },
      },
    });
    return;
  }

  await prisma.purchaseRequestFlag.create({
    data: {
      requestId,
      type: "SPLIT_PURCHASE_RISK",
      severity: "HIGH",
      message,
      metadata: {
        requestIds: cluster.requestIds,
        combinedSpend: cluster.combinedSpend,
        exceededLimit: cluster.exceededLimit,
      },
    },
  });
}

/* --- ON-CREATE EVALUATION --- */

export async function evaluateSplitPurchaseOnCreate(
  request: {
    id: number;
    requester: string;
    requesterId?: number | null;
    departmentId?: number | null;
    category?: string | null;
    categoryId?: number | null;
    vendorName?: string | null;
  },
  actor = "System"
) {
  const cluster =
    await findSplitPurchaseCluster({
      requestId: request.id,
      requester: request.requester,
      requesterId: request.requesterId,
      departmentId: request.departmentId,
      category: request.category,
      categoryId: request.categoryId,
      vendorName: request.vendorName,
    });

  if (!cluster) {
    return null;
  }

  for (const requestId of cluster.requestIds) {
    await upsertSplitPurchaseFlag(
      requestId,
      cluster
    );
  }

  await recordAuditLog(
    "PurchaseRequest",
    request.id,
    "SPLIT_PURCHASE_DETECTED",
    actor,
    {
      newValue: {
        type: "SPLIT_PURCHASE_RISK",
        requestCount: cluster.requestCount,
        combinedSpend: cluster.combinedSpend,
        exceededLimit: cluster.exceededLimit,
        limitLabel: cluster.limitLabel,
        relatedRequestIds:
          cluster.requestIds,
      },
      metadata: {
        vendorName: cluster.vendorName,
        category: cluster.category,
        department: cluster.department,
        windowDays: cluster.windowDays,
      },
    }
  );

  return cluster;
}

/* --- DASHBOARD ALERTS --- */

export async function getSplitPurchaseAlertCount() {
  return prisma.purchaseRequestFlag.count({
    where: {
      type: "SPLIT_PURCHASE_RISK",
      resolved: false,
    },
  });
}

export async function getSplitPurchaseAlerts(
  limit = 5
) {
  const flags =
    await prisma.purchaseRequestFlag.findMany({
      where: {
        type: "SPLIT_PURCHASE_RISK",
        resolved: false,
      },
      include: {
        request: {
          select: {
            id: true,
            title: true,
            requester: true,
            estimatedAmount: true,
            vendorName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

  return flags.map((flag) => {
    const metadata = (flag.metadata ??
      {}) as {
      combinedSpend?: number;
      requestIds?: number[];
    };

    return {
      id: flag.request.id,
      flagId: flag.id,
      title: flag.request.title,
      requester: flag.request.requester,
      vendorName:
        flag.request.vendorName ?? "—",
      amount: flag.request.estimatedAmount,
      combinedSpend:
        metadata.combinedSpend ??
        flag.request.estimatedAmount,
      requestCount:
        metadata.requestIds?.length ?? 1,
      message: flag.message,
    };
  });
}

export async function getPolicyViolationSummary() {
  const [
    duplicateInvoices,
    splitPurchases,
  ] = await Promise.all([
    prisma.document.count({
      where: { status: "blocked" },
    }),
    getSplitPurchaseAlertCount(),
  ]);

  return {
    duplicateInvoices,
    splitPurchases,
    approvalBypassAttempts: splitPurchases,
    total:
      duplicateInvoices + splitPurchases,
  };
}
