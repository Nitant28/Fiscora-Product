/**
 * Module: Onboarding Wizard
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth, requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import {
  applyApprovalTemplate,
  completeOnboarding,
  createDepartment,
  createTenantWithAdmin,
  getOnboardingStatus,
  importUsersFromCsv,
  updateCompanyProfile,
  updateDepartmentBudget,
} from "../../services/onboardingEngine";
import { getImportSummary } from "../../services/importCenter";
import { loginUser } from "../../lib/auth";

export async function onboardingRoutes(app: FastifyInstance) {
  app.post("/onboarding/register", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      companyName?: string;
      adminName?: string;
      adminEmail?: string;
      adminPassword?: string;
      industry?: string;
      currency?: string;
      timezone?: string;
    };

    if (
      !body.companyName?.trim() ||
      !body.adminName?.trim() ||
      !body.adminEmail?.trim() ||
      !body.adminPassword
    ) {
      return reply.status(400).send({
        success: false,
        error: "Company name, admin name, email, and password are required",
      });
    }

    try {
      await createTenantWithAdmin({
        companyName: body.companyName,
        adminName: body.adminName,
        adminEmail: body.adminEmail,
        adminPassword: body.adminPassword,
        industry: body.industry,
        currency: body.currency,
        timezone: body.timezone,
      });

      const login = await loginUser(body.adminEmail, body.adminPassword);
      return reply.send({ success: true, ...login });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      return reply.status(400).send({ success: false, error: message });
    }
  });

  app.get(
    "/onboarding/status",
    { preHandler: requireAuth },
    async (_request, reply) => {
      const status = await getOnboardingStatus();
      return reply.send({ success: true, ...status });
    }
  );

  app.get(
    "/onboarding/summary",
    { preHandler: requireAuth },
    async (_request, reply) => {
      const summary = await getImportSummary();
      return reply.send({ success: true, summary });
    }
  );

  app.post(
    "/onboarding/company",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        name?: string;
        industry?: string;
        currency?: string;
        timezone?: string;
      };

      if (!body.name?.trim()) {
        return reply.status(400).send({ success: false, error: "Company name is required" });
      }

      const tenant = await updateCompanyProfile({
        name: body.name,
        industry: body.industry,
        currency: body.currency,
        timezone: body.timezone,
      });

      return reply.send({ success: true, tenant });
    }
  );

  app.post(
    "/onboarding/departments",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { name?: string; budget?: number };

      if (!body.name?.trim()) {
        return reply.status(400).send({ success: false, error: "Department name is required" });
      }

      const department = await createDepartment({
        name: body.name,
        budget: body.budget,
      });

      return reply.send({ success: true, department });
    }
  );

  app.patch(
    "/onboarding/departments/:id/budget",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { budget?: number };

      if (body.budget == null) {
        return reply.status(400).send({ success: false, error: "Budget is required" });
      }

      try {
        const department = await updateDepartmentBudget(Number(id), body.budget);
        return reply.send({ success: true, department });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Update failed";
        return reply.status(400).send({ success: false, error: message });
      }
    }
  );

  app.post(
    "/onboarding/users/import",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { csv?: string; fileName?: string };

      if (!body.csv?.trim()) {
        return reply.status(400).send({ success: false, error: "CSV content required" });
      }

      const result = await importUsersFromCsv(
        body.csv,
        body.fileName?.trim() || "onboarding-users.csv",
        request.user?.id
      );

      return reply.send({ success: true, ...result });
    }
  );

  app.post(
    "/onboarding/approval-rules",
    { preHandler: requirePermission(PERMISSION_KEYS.APPROVAL_RULE_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { template?: "small" | "medium" | "enterprise" };

      if (!body.template || !["small", "medium", "enterprise"].includes(body.template)) {
        return reply.status(400).send({ success: false, error: "Valid template required" });
      }

      const rules = await applyApprovalTemplate(body.template);
      return reply.send({ success: true, rules });
    }
  );

  app.post(
    "/onboarding/complete",
    { preHandler: requirePermission(PERMISSION_KEYS.USER_MANAGE) },
    async (_request, reply) => {
      const tenant = await completeOnboarding();
      return reply.send({ success: true, tenant });
    }
  );
}
