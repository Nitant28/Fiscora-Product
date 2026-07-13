/**
 * Module: Departments
 * Purpose: Department directory and budget availability checks for purchase requests.
 * Endpoints:
 *   GET /departments
 *   GET /departments/check-budget
 *   GET /departments/:id
 */
import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import {
  checkBudgetHandler,
  getDepartmentHandler,
  listDepartmentsHandler,
} from "./department.controller";

export async function departmentRoutes(
  app: FastifyInstance
) {
  // --- List departments ---
  app.get(
    "/departments",
    { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_VIEW) },
    listDepartmentsHandler
  );

  // --- Check department budget ---
  app.get(
    "/departments/check-budget",
    { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_CREATE) },
    checkBudgetHandler
  );

  // --- Get department by id ---
  app.get(
    "/departments/:id",
    { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_VIEW) },
    getDepartmentHandler
  );
}
