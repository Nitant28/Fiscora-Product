import { FastifyInstance } from "fastify";

import {
  getAuditSummary,
  getAuditEvents,
  getFraudSummary,
  getRiskMetrics,
  searchAuditLogs,
  getAuditFacets,
  exportAuditLogsCsv,
  type AuditLogFilter,
} from "../services/auditCenter";

import { requirePermission } from "../lib/authMiddleware";
import { PERMISSION_KEYS } from "../lib/permissions";

export default async function auditRoutes(
  app: FastifyInstance
) {
  console.log(
    "AUDIT ROUTES REGISTERED"
  );

  app.get("/audit/test", async () => {
    return { ok: true };
  });

  app.get(
    "/audit/summary",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.AUDIT_VIEW),
      ],
    },
    async () => {
      return getAuditSummary();
    }
  );

  app.get(
    "/audit/events",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.AUDIT_VIEW),
      ],
    },
    async () => {
      return getAuditEvents();
    }
  );

  app.get(
    "/audit/logs",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.AUDIT_VIEW),
      ],
    },
    async (request) => {
      const q = request.query as Record<string, string>;
      const filter: AuditLogFilter = {
        q: q.q || undefined,
        entityType: q.entityType || undefined,
        action: q.action || undefined,
        actorUserId: q.actorUserId
          ? Number.parseInt(q.actorUserId, 10)
          : undefined,
        from: q.from || undefined,
        to: q.to || undefined,
        limit: q.limit ? Number.parseInt(q.limit, 10) : undefined,
        cursor: q.cursor ? Number.parseInt(q.cursor, 10) : undefined,
      };
      const result = await searchAuditLogs(filter);
      return { success: true, ...result };
    }
  );

  app.get(
    "/audit/facets",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.AUDIT_VIEW),
      ],
    },
    async () => {
      const facets = await getAuditFacets();
      return { success: true, ...facets };
    }
  );

  app.get(
    "/audit/export",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.AUDIT_EXPORT),
      ],
    },
    async (request, reply) => {
      const q = request.query as Record<string, string>;
      const csv = await exportAuditLogsCsv({
        q: q.q || undefined,
        entityType: q.entityType || undefined,
        action: q.action || undefined,
        actorUserId: q.actorUserId
          ? Number.parseInt(q.actorUserId, 10)
          : undefined,
        from: q.from || undefined,
        to: q.to || undefined,
      });
      const filename = `audit-log-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        )
        .send(csv);
    }
  );

  app.get(
    "/audit/fraud",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.AUDIT_VIEW),
      ],
    },
    async () => {
      return getFraudSummary();
    }
  );

  app.get(
    "/audit/risks",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.AUDIT_VIEW),
      ],
    },
    async () => {
      return getRiskMetrics();
    }
  );
}