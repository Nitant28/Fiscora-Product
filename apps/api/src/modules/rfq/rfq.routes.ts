/**
 * Module: RFQ
 * Purpose: Request-for-quote lifecycle — bids, scoring, award, savings, and PO generation.
 * Endpoints:
 *   POST /rfqs
 *   GET  /rfqs, /rfqs/:id
 *   POST /rfqs/:id/bids
 *   GET  /rfqs/:id/bids, /rfqs/:id/recommendation, /rfqs/:id/savings
 *   POST /rfqs/:id/score, /rfqs/:id/open, /rfqs/:id/award, /rfqs/:id/generate-po
 */
import type { FastifyInstance } from "fastify";
import {
  requirePermission,
} from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import {
  awardVendorHandler,
  createBidHandler,
  createRFQHandler,
  generatePOFromRFQHandler,
  getRFQHandler,
  getRFQRecommendationHandler,
  getRFQSavingsHandler,
  listRFQBidsHandler,
  listRFQsHandler,
  openRFQHandler,
  scoreRFQHandler,
} from "./rfq.controller";

export async function rfqRoutes(app: FastifyInstance) {
  // --- Create RFQ ---
  app.post(
    "/rfqs",
    { preHandler: requirePermission(PERMISSION_KEYS.RFQ_CREATE) },
    createRFQHandler
  );

  // --- List and get RFQ ---
  app.get(
    "/rfqs",
    { preHandler: requirePermission(PERMISSION_KEYS.RFQ_VIEW) },
    listRFQsHandler
  );

  app.get(
    "/rfqs/:id",
    { preHandler: requirePermission(PERMISSION_KEYS.RFQ_VIEW) },
    getRFQHandler
  );

  // --- Vendor bids ---
  app.post(
    "/rfqs/:id/bids",
    { preHandler: requirePermission(PERMISSION_KEYS.VENDOR_BID_SUBMIT) },
    createBidHandler
  );

  app.get(
    "/rfqs/:id/bids",
    { preHandler: requirePermission(PERMISSION_KEYS.RFQ_VIEW) },
    listRFQBidsHandler
  );

  // --- Scoring and recommendations ---
  app.post(
    "/rfqs/:id/score",
    { preHandler: requirePermission(PERMISSION_KEYS.RFQ_MANAGE) },
    scoreRFQHandler
  );

  app.get(
    "/rfqs/:id/recommendation",
    { preHandler: requirePermission(PERMISSION_KEYS.RFQ_VIEW) },
    getRFQRecommendationHandler
  );

  app.get(
    "/rfqs/:id/savings",
    { preHandler: requirePermission(PERMISSION_KEYS.RFQ_VIEW) },
    getRFQSavingsHandler
  );

  // --- Open and award RFQ ---
  app.post(
    "/rfqs/:id/open",
    { preHandler: requirePermission(PERMISSION_KEYS.RFQ_OPEN) },
    openRFQHandler
  );

  app.post(
    "/rfqs/:id/award",
    { preHandler: requirePermission(PERMISSION_KEYS.RFQ_AWARD) },
    awardVendorHandler
  );

  // --- Generate PO from awarded RFQ ---
  app.post(
    "/rfqs/:id/generate-po",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_CREATE) },
    generatePOFromRFQHandler
  );
}
