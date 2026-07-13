import prisma from "../db";

export async function getAuditSummary() {
  const [
    totalEvents,
    approvals,
    violations,
    fraudAlerts,
  ] = await Promise.all([
    prisma.auditLog.count(),

    prisma.auditLog.count({
      where: {
        action: {
          contains: "APPROVE",
        },
      },
    }),

    prisma.purchaseRequestFlag.count({
      where: {
        resolved: false,
      },
    }),

    prisma.invoiceFlag.count({
      where: {
        resolved: false,
      },
    }),
  ]);

  return {
    totalEvents,
    approvals,
    violations,
    fraudAlerts,
  };
}

export async function getAuditEvents(
  limit = 100
) {
  return prisma.auditLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

export async function getFraudSummary() {
  const duplicateInvoices =
    await prisma.invoiceFlag.count({
      where: {
        message: {
          contains: "duplicate",
          mode: "insensitive",
        },
      },
    });

  const splitPurchases =
    await prisma.purchaseRequestFlag.count({
      where: {
        type: "SPLIT_PURCHASE",
      },
    });

  return {
    duplicateInvoices,
    splitPurchases,
  };
}

/* --- AUDIT CENTER: searchable forensic log (Sprint 24) --- */

export interface AuditLogFilter {
  q?: string;
  entityType?: string;
  action?: string;
  actorUserId?: number;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: number;
}

function buildAuditWhere(filter: AuditLogFilter) {
  const where: Record<string, unknown> = {};

  if (filter.entityType) where.entityType = filter.entityType;
  if (filter.actorUserId) where.actorUserId = filter.actorUserId;
  if (filter.action) {
    where.action = { contains: filter.action, mode: "insensitive" };
  }

  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: new Date(filter.from) } : {}),
      ...(filter.to ? { lte: new Date(filter.to) } : {}),
    };
  }

  if (filter.q) {
    where.OR = [
      { actor: { contains: filter.q, mode: "insensitive" } },
      { action: { contains: filter.q, mode: "insensitive" } },
      { entityType: { contains: filter.q, mode: "insensitive" } },
      { reason: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function searchAuditLogs(filter: AuditLogFilter) {
  const limit = Math.min(
    Math.max(filter.limit ?? 50, 1),
    200
  );
  const where = buildAuditWhere(filter);

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(filter.cursor
      ? { cursor: { id: filter.cursor }, skip: 1 }
      : {}),
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return { items, nextCursor, hasMore };
}

/** Distinct entity types and actions, for building filter dropdowns. */
export async function getAuditFacets() {
  const [entityTypes, actions] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  return {
    entityTypes: entityTypes.map((e) => e.entityType),
    actions: actions.map((a) => a.action),
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Exports filtered audit logs as a CSV string (compliance evidence). */
export async function exportAuditLogsCsv(
  filter: AuditLogFilter
): Promise<string> {
  const where = buildAuditWhere(filter);
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const headers = [
    "id",
    "createdAt",
    "actor",
    "actorRole",
    "action",
    "entityType",
    "entityId",
    "permission",
    "ipAddress",
    "reason",
  ];

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt.toISOString(),
        r.actor,
        r.actorRole ?? "",
        r.action,
        r.entityType,
        r.entityId,
        r.permission ?? "",
        r.ipAddress ?? "",
        r.reason ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return lines.join("\n");
}

export async function getRiskMetrics() {
  const highRiskVendors =
    await prisma.vendor.count({
      where: {
        riskLevel: "HIGH",
      },
    });

  const expiringContracts =
    await prisma.contract.count({
      where: {
        endDate: {
          lte: new Date(
            Date.now() +
              30 * 24 * 60 * 60 * 1000
          ),
        },
      },
    });

  return {
    highRiskVendors,
    expiringContracts,
  };
}