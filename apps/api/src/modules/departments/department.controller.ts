/**
 * Module: Departments (controller)
 * Purpose: HTTP handlers for department listing, detail, and budget checks.
 * Handlers:
 *   listDepartmentsHandler
 *   getDepartmentHandler
 *   checkBudgetHandler
 */
import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";
import {
  checkBudget,
  getDepartment,
  listDepartments,
  seedDepartmentsIfEmpty,
} from "./department.service";

// --- List departments ---
export async function listDepartmentsHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await seedDepartmentsIfEmpty();
    const departments =
      await listDepartments();
    return reply.send({
      success: true,
      departments,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to list departments",
    });
  }
}

// --- Get department by id ---
export async function getDepartmentHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };
    const dept = await getDepartment(
      Number(id)
    );
    if (!dept) {
      return reply.status(404).send({
        success: false,
        error: "Department not found",
      });
    }
    return reply.send({
      success: true,
      department: dept,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to load department",
    });
  }
}

// --- Check department budget ---
export async function checkBudgetHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { departmentId, amount } =
      request.query as {
        departmentId: string;
        amount: string;
      };

    const result = await checkBudget(
      Number(departmentId),
      Number(amount)
    );

    return reply.send({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Budget check failed",
    });
  }
}
