/**
 * Module: Purchase Requests
 * Purpose: Purchase requisition workflow — create, list, approve, and reject.
 * Endpoints:
 *   POST  /purchase-requests
 *   GET   /purchase-requests
 *   GET   /purchase-requests/:id
 *   PATCH /purchase-requests/:id/approve
 *   PATCH /purchase-requests/:id/reject
 */
import type { FastifyInstance } from "fastify";
import {
  requirePermission,
} from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import {
  approveRequestHandler,
  createRequestHandler,
  getRequestHandler,
  listRequestsHandler,
  rejectRequestHandler,
} from "./purchase-request.controller";

export async function purchaseRequestRoutes(
  app: FastifyInstance
) {
  // --- Create purchase request ---
  app.post(
    "/purchase-requests",
    { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_CREATE) },
    createRequestHandler
  );

  // --- List and get purchase requests ---
  app.get(
    "/purchase-requests",
    { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_VIEW) },
    listRequestsHandler
  );

  app.get(
    "/purchase-requests/:id",
    { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_VIEW) },
    getRequestHandler
  );

  // --- Approve purchase request ---
  app.patch(
    "/purchase-requests/:id/approve",
    { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_APPROVE) },
    approveRequestHandler
  );

  // --- Reject purchase request ---
  app.patch(
    "/purchase-requests/:id/reject",
    { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_REJECT) },
    rejectRequestHandler
  );
}
