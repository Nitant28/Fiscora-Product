/**
 * Module: Purchase Orders
 * Purpose: PO lifecycle, goods receipt, invoice matching, and PO generation from requests.
 * Endpoints:
 *   GET   /purchase-orders
 *   GET   /purchase-orders/:id
 *   POST  /purchase-requests/:requestId/generate-po
 *   PATCH|POST /purchase-orders/:id/send|accept|receive|close
 *   GET|POST /purchase-orders/:id/receipts
 *   GET   /documents/:documentId/po-match
 */
import type { FastifyInstance } from "fastify";
import {
  requirePermission,
} from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import {
  closePOHandler,
  createGoodsReceiptHandler,
  generatePOHandler,
  getPOHandler,
  listGoodsReceiptsHandler,
  listPOsHandler,
  markAcceptedHandler,
  markReceivedHandler,
  matchInvoiceHandler,
  sendPOHandler,
} from "./purchase-order.controller";

export async function purchaseOrderRoutes(
  app: FastifyInstance
) {
  // --- List and get purchase orders ---
  app.get(
    "/purchase-orders",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_VIEW) },
    listPOsHandler
  );

  app.get(
    "/purchase-orders/:id",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_VIEW) },
    getPOHandler
  );

  // --- Generate PO from purchase request ---
  app.post(
    "/purchase-requests/:requestId/generate-po",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_CREATE) },
    generatePOHandler
  );

  // --- Send PO to vendor ---
  app.patch(
    "/purchase-orders/:id/send",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_SEND) },
    sendPOHandler
  );

  app.post(
    "/purchase-orders/:id/send",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_SEND) },
    sendPOHandler
  );

  // --- Mark PO accepted ---
  app.patch(
    "/purchase-orders/:id/accept",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_MANAGE) },
    markAcceptedHandler
  );

  app.post(
    "/purchase-orders/:id/accept",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_MANAGE) },
    markAcceptedHandler
  );

  // --- Mark PO received ---
  app.patch(
    "/purchase-orders/:id/receive",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_RECEIVE) },
    markReceivedHandler
  );

  app.post(
    "/purchase-orders/:id/receive",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_RECEIVE) },
    markReceivedHandler
  );

  // --- Close PO ---
  app.patch(
    "/purchase-orders/:id/close",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_MANAGE) },
    closePOHandler
  );

  app.post(
    "/purchase-orders/:id/close",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_MANAGE) },
    closePOHandler
  );

  // --- Goods receipts ---
  app.get(
    "/purchase-orders/:id/receipts",
    { preHandler: requirePermission(PERMISSION_KEYS.PO_VIEW) },
    listGoodsReceiptsHandler
  );

  app.post(
    "/purchase-orders/:id/receipts",
    { preHandler: requirePermission(PERMISSION_KEYS.GRN_CREATE) },
    createGoodsReceiptHandler
  );

  // --- Invoice PO match ---
  app.get(
    "/documents/:documentId/po-match",
    { preHandler: requirePermission(PERMISSION_KEYS.INVOICE_VIEW) },
    matchInvoiceHandler
  );
}
