/**
 * Module: Tally integration — governed CSV export center for Indian accounting.
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import { recordAuditLog } from "../../lib/audit";
import {
  exportTallyByType,
  getTallyExportSummary,
  listTallyExportHistory,
} from "./tallyExport";
import { parseTallyExportFilters } from "./tallyGovernance";
import type { TallyExportType } from "./tallyMappings";

const VALID_TYPES = new Set<TallyExportType>([
  "vendors",
  "purchase-orders",
  "invoices",
  "payments",
]);

function parseExportType(
  value: string | undefined
): TallyExportType | null {
  if (!value || !VALID_TYPES.has(value as TallyExportType)) {
    return null;
  }

  return value as TallyExportType;
}

export async function tallyRoutes(app: FastifyInstance) {
  app.get(
    "/integrations/tally/summary",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.TALLY_EXPORT),
      ],
    },
    async (request) => {
      const filters = parseTallyExportFilters(
        request.query as Record<string, string | undefined>
      );

      return getTallyExportSummary(filters);
    }
  );

  app.get(
    "/integrations/tally/history",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.TALLY_EXPORT),
      ],
    },
    async (request) => {
      const limitRaw = (request.query as { limit?: string }).limit;
      const limit = limitRaw
        ? Number.parseInt(limitRaw, 10)
        : 20;

      return {
        history: await listTallyExportHistory(
          Number.isFinite(limit) ? limit : 20
        ),
      };
    }
  );

  app.get(
    "/integrations/tally/:type",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.TALLY_EXPORT),
      ],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const type = parseExportType(
        (request.params as { type: string }).type
      );

      if (!type) {
        return reply.status(400).send({
          success: false,
          error: "Invalid export type",
        });
      }

      const query = request.query as Record<
        string,
        string | undefined
      > & { format?: string };

      const format = query.format ?? "json";
      const filters = parseTallyExportFilters(query);
      const actor = request.user
        ? {
            id: request.user.id,
            name: request.user.name,
            role: request.user.role,
          }
        : undefined;

      const data = await exportTallyByType(
        type,
        filters,
        actor
      );

      await recordAuditLog(
        "TallyExport",
        0,
        "TALLY_EXPORT",
        request.user?.name ?? "System",
        {
          newValue: {
            type,
            count: data.count,
            excludedCount: data.excludedCount,
            format,
            filters,
          },
          actorContext: request.user
            ? {
                userId: request.user.id,
                role: request.user.role,
                permission:
                  PERMISSION_KEYS.TALLY_EXPORT,
              }
            : undefined,
        }
      );

      if (format === "csv") {
        reply.header(
          "Content-Type",
          "text/csv; charset=utf-8"
        );
        reply.header(
          "Content-Disposition",
          `attachment; filename="${data.filename}"`
        );
        return reply.send(data.csv);
      }

      return {
        success: true,
        ...data,
      };
    }
  );
}
