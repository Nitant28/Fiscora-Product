/**
 * Module: Import Center
 * POST /import/vendors | /import/users | /import/departments | /import/budgets
 * GET  /import/jobs
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import {
  importBudgetsFromCsv,
  importDepartmentsFromCsv,
  importUsersFromCsv,
  importVendorsFromCsv,
  listImportJobs,
} from "../../services/importCenter";

async function readCsvBody(request: FastifyRequest) {
  const body = request.body as {
    csv?: string;
    fileName?: string;
    defaultPassword?: string;
  };

  if (!body?.csv?.trim()) {
    return null;
  }

  return {
    csv: body.csv,
    fileName: body.fileName?.trim() || "upload.csv",
    defaultPassword: body.defaultPassword,
  };
}

export async function importRoutes(app: FastifyInstance) {
  app.get(
    "/import/jobs",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (_request, reply) => {
      const jobs = await listImportJobs();
      return reply.send({ success: true, jobs });
    }
  );

  app.post(
    "/import/vendors",
    { preHandler: requirePermission(PERMISSION_KEYS.VENDOR_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = await readCsvBody(request);
      if (!payload) {
        return reply.status(400).send({ success: false, error: "CSV content required" });
      }

      const result = await importVendorsFromCsv(
        payload.csv,
        payload.fileName,
        request.user?.id
      );

      return reply.send({ success: true, ...result });
    }
  );

  app.post(
    "/import/departments",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = await readCsvBody(request);
      if (!payload) {
        return reply.status(400).send({ success: false, error: "CSV content required" });
      }

      const result = await importDepartmentsFromCsv(
        payload.csv,
        payload.fileName,
        request.user?.id
      );

      return reply.send({ success: true, ...result });
    }
  );

  app.post(
    "/import/budgets",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = await readCsvBody(request);
      if (!payload) {
        return reply.status(400).send({ success: false, error: "CSV content required" });
      }

      const result = await importBudgetsFromCsv(
        payload.csv,
        payload.fileName,
        request.user?.id
      );

      return reply.send({ success: true, ...result });
    }
  );

  app.post(
    "/import/users",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = await readCsvBody(request);
      if (!payload) {
        return reply.status(400).send({ success: false, error: "CSV content required" });
      }

      const result = await importUsersFromCsv(
        payload.csv,
        payload.fileName,
        request.user?.id,
        { defaultPassword: payload.defaultPassword }
      );

      return reply.send({ success: true, ...result });
    }
  );
}
