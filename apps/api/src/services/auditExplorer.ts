/**
 * Domain: Forensic audit explorer — filterable, paginated audit-trail queries + CSV export.
 * Answers enterprise questions: who did what, when, from where, old vs new value, and why.
 */
import prisma from "../db";
import type { Prisma } from "@prisma/client";

export type AuditQueryFilters = {
  actor?: string;
  actorUserId?: number;
  entityType?: string;
  entityId?: number;
  action?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
};

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

function buildWhere(
  filters: AuditQueryFilters
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.actorUserId != null) {
    where.actorUserId = filters.actorUserId;
  }

  if (filters.actor) {
    where.actor = {
      contains: filters.actor,
      mode: "insensitive",
    };
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.entityId != null) {
    where.entityId = filters.entityId;
  }

  if (filters.action) {
    where.action = {
      contains: filters.action,
      mode: "insensitive",
    };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      where.createdAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.createdAt.lte = filters.dateTo;
    }
  }

  if (filters.search) {
    where.OR = [
      {
        action: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        actor: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        entityType: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
    ];
  }

  return where;
}

export async function queryAuditLogs(
  filters: AuditQueryFilters
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE)
  );
  const where = buildWhere(filters);

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(
      1,
      Math.ceil(total / pageSize)
    ),
  };
}

/** Distinct entity types and actions to power filter dropdowns. */
export async function getAuditFilterOptions() {
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
      take: 200,
    }),
  ]);

  return {
    entityTypes: entityTypes.map((e) => e.entityType),
    actions: actions.map((a) => a.action),
  };
}

function csvCell(value: unknown): string {
  if (value == null) {
    return "";
  }
  const str =
    typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  // Escape per RFC 4180: wrap in quotes and double embedded quotes.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportAuditLogsCsv(
  filters: AuditQueryFilters
): Promise<string> {
  const where = buildWhere(filters);
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const headers = [
    "id",
    "timestamp",
    "actor",
    "actorUserId",
    "actorRole",
    "action",
    "entityType",
    "entityId",
    "permission",
    "ipAddress",
    "userAgent",
    "reason",
    "requestId",
    "oldValue",
    "newValue",
  ];

  const lines = [headers.join(",")];

  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt.toISOString(),
        r.actor,
        r.actorUserId,
        r.actorRole,
        r.action,
        r.entityType,
        r.entityId,
        r.permission,
        r.ipAddress,
        r.userAgent,
        r.reason,
        r.requestId,
        r.oldValue,
        r.newValue,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return lines.join("\r\n");
}
