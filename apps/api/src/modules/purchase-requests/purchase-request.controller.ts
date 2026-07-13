/**
 * Module: Purchase Requests (controller)
 * Purpose: HTTP handlers for requisition create, list, detail, approval, and rejection.
 * Handlers:
 *   createRequestHandler, listRequestsHandler, getRequestHandler
 *   approveRequestHandler, rejectRequestHandler
 */
import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { auditContextFromRequest } from "../../lib/audit";
import { canApprove } from "../../lib/auth";
import {
  approveRequest,
  createRequest,
  getRequest,
  listRequests,
  rejectRequest,
} from "./purchase-request.service";
import { getSplitPurchaseRiskForRequest } from "../../services/splitPurchaseFraud";
import type { CreatePurchaseRequestInput } from "./purchase-request.types";

// --- Create purchase request ---
export async function createRequestHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body =
      request.body as CreatePurchaseRequestInput;

    if (
      !body?.title?.trim() ||
      !body?.vendorName?.trim() ||
      body?.estimatedAmount == null ||
      !Number.isFinite(body.estimatedAmount) ||
      body.estimatedAmount < 0 ||
      body?.categoryId == null ||
      !Number.isFinite(body.categoryId)
    ) {
      return reply.status(400).send({
        success: false,
        error:
          "title, vendorName, estimatedAmount, categoryId required",
      });
    }

    const requester =
      request.user?.name ??
      body.requester?.trim();

    if (!requester) {
      return reply.status(400).send({
        success: false,
        error: "requester required",
      });
    }

    const record = await createRequest({
      ...body,
      requester,
      requesterId: request.user?.id,
      actorContext: auditContextFromRequest({
        user: request.user ?? null,
        permission:
          request.permissionUsed ?? undefined,
      }),
    });

    return reply.status(201).send({
      success: true,
      request: record,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create request";

    const isBudget =
      message.includes("Budget");

    return reply.status(isBudget ? 400 : 500).send({
      success: false,
      error: message,
    });
  }
}

// --- List and get purchase requests ---
export async function listRequestsHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const requests = await listRequests();

    return reply.send({
      success: true,
      requests,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to list requests",
    });
  }
}

export async function getRequestHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };

    const record = await getRequest(
      Number(id)
    );

    if (!record) {
      return reply.status(404).send({
        success: false,
        error: "Request not found",
      });
    }

    const splitPurchaseRisk =
      await getSplitPurchaseRiskForRequest(
        Number(id)
      );

    return reply.send({
      success: true,
      request: record,
      splitPurchaseRisk,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to load request",
    });
  }
}

// --- Approve purchase request ---
export async function approveRequestHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };

    const existing = await getRequest(
      Number(id)
    );

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: "Request not found",
      });
    }

    if (existing.status !== "SUBMITTED") {
      return reply.status(400).send({
        success: false,
        error:
          "Only submitted requests can be approved",
      });
    }

    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: "Authentication required",
      });
    }

    if (
      !canApprove(
        user.role,
        existing.assignedApprover
      )
    ) {
      return reply.status(403).send({
        success: false,
        error: "Not authorized to approve this request",
      });
    }

    const record = await approveRequest(
      Number(id),
      user.name,
      auditContextFromRequest({
        user,
        permission:
          request.permissionUsed ?? undefined,
      })
    );

    return reply.send({
      success: true,
      request: record,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to approve request",
    });
  }
}

// --- Reject purchase request ---
export async function rejectRequestHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };

    const existing = await getRequest(
      Number(id)
    );

    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: "Request not found",
      });
    }

    if (existing.status !== "SUBMITTED") {
      return reply.status(400).send({
        success: false,
        error:
          "Only submitted requests can be rejected",
      });
    }

    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: "Authentication required",
      });
    }

    if (
      !canApprove(
        user.role,
        existing.assignedApprover
      )
    ) {
      return reply.status(403).send({
        success: false,
        error: "Not authorized to reject this request",
      });
    }

    const record = await rejectRequest(
      Number(id),
      user.name,
      auditContextFromRequest({
        user,
        permission:
          request.permissionUsed ?? undefined,
      })
    );

    return reply.send({
      success: true,
      request: record,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to reject request",
    });
  }
}
