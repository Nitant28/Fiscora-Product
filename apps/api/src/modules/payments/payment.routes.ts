/**
 * Module: Payments
 * Purpose: Invoice payment lifecycle, cash-flow forecast, and vendor payment analytics.
 * Endpoints:
 *   GET  /payments
 *   GET  /payments/cash-flow
 *   GET  /payments/vendor-performance
 *   GET  /payments/msme-alerts
 *   GET  /payments/:id
 *   POST /payments/:id/ready
 *   POST /payments/:id/process
 *   POST /payments/:id/pay
 */
import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import {
  cashFlowForecastHandler,
  getPaymentHandler,
  listPaymentsHandler,
  markPaymentPaidHandler,
  markPaymentReadyHandler,
  msmePaymentAlertsHandler,
  startPaymentProcessingHandler,
  vendorPaymentPerformanceHandler,
} from "./payment.controller";

export async function paymentRoutes(
  app: FastifyInstance
) {
  // --- List payments ---
  app.get(
    "/payments",
    { preHandler: requirePermission(PERMISSION_KEYS.PAYMENT_VIEW) },
    listPaymentsHandler
  );

  // --- Cash-flow forecast ---
  app.get(
    "/payments/cash-flow",
    { preHandler: requirePermission(PERMISSION_KEYS.CASHFORECAST_VIEW) },
    cashFlowForecastHandler
  );

  // --- Vendor payment performance ---
  app.get(
    "/payments/vendor-performance",
    { preHandler: requirePermission(PERMISSION_KEYS.PAYMENT_VIEW) },
    vendorPaymentPerformanceHandler
  );

  // --- MSME payment alerts ---
  app.get(
    "/payments/msme-alerts",
    { preHandler: requirePermission(PERMISSION_KEYS.PAYMENT_VIEW) },
    msmePaymentAlertsHandler
  );

  // --- Get payment by id ---
  app.get(
    "/payments/:id",
    { preHandler: requirePermission(PERMISSION_KEYS.PAYMENT_VIEW) },
    getPaymentHandler
  );

  // --- Mark payment ready ---
  app.post(
    "/payments/:id/ready",
    { preHandler: requirePermission(PERMISSION_KEYS.PAYMENT_PROCESS) },
    markPaymentReadyHandler
  );

  // --- Start payment processing ---
  app.post(
    "/payments/:id/process",
    { preHandler: requirePermission(PERMISSION_KEYS.PAYMENT_PROCESS) },
    startPaymentProcessingHandler
  );

  // --- Mark payment paid ---
  app.post(
    "/payments/:id/pay",
    { preHandler: requirePermission(PERMISSION_KEYS.PAYMENT_MARK_PAID) },
    markPaymentPaidHandler
  );
}
