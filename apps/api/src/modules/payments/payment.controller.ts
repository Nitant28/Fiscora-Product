/**
 * Module: Payments (controller)
 * Purpose: HTTP handlers for payment listing, lifecycle actions, and payment analytics.
 * Handlers:
 *   listPaymentsHandler, getPaymentHandler
 *   markPaymentReadyHandler, startPaymentProcessingHandler, markPaymentPaidHandler
 *   cashFlowForecastHandler, vendorPaymentPerformanceHandler, msmePaymentAlertsHandler
 */
import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { auditContextFromRequest } from "../../lib/audit";
import {
  getCashFlowForecast,
  getMsmePaymentAlerts,
  getPaymentById,
  getVendorPaymentPerformance,
  listPayments,
  markPaymentPaid,
  markPaymentReady,
  startPaymentProcessing,
} from "../../services/paymentEngine";

// --- Internal helpers ---
function resolveActor(
  request: FastifyRequest,
  body?: { actorName?: string }
) {
  return (
    body?.actorName?.trim() ||
    (request as any).user?.name ||
    "System"
  );
}

// --- List and get payments ---
export async function listPaymentsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query = request.query as {
      status?: string;
      vendorId?: string;
    };

    const payments = await listPayments({
      status: query.status,
      vendorId: query.vendorId
        ? Number(query.vendorId)
        : undefined,
    });

    return reply.send({
      success: true,
      payments,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to list payments",
    });
  }
}

export async function getPaymentHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as {
      id: string;
    };

    const payment = await getPaymentById(
      Number(id)
    );

    if (!payment) {
      return reply.status(404).send({
        success: false,
        error: "Payment not found",
      });
    }

    return reply.send({
      success: true,
      payment,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to fetch payment",
    });
  }
}

// --- Payment lifecycle actions ---
async function paymentActionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  action: "ready" | "process" | "pay"
) {
  try {
    const { id } = request.params as {
      id: string;
    };

    const body = (request.body ?? {}) as {
      actorName?: string;
    };

    const actor = resolveActor(
      request,
      body
    );

    let payment;

    if (action === "ready") {
      payment = await markPaymentReady(
        Number(id),
        actor
      );
    } else if (action === "process") {
      payment =
        await startPaymentProcessing(
          Number(id),
          actor
        );
    } else {
      payment = await markPaymentPaid(
        Number(id),
        actor,
        auditContextFromRequest({
          user: request.user ?? null,
          permission:
            request.permissionUsed ?? undefined,
        })
      );
    }

    return reply.send({
      success: true,
      payment,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Payment action failed";

    const status =
      message === "Payment not found"
        ? 404
        : 400;

    return reply.status(status).send({
      success: false,
      error: message,
    });
  }
}

export async function markPaymentReadyHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  return paymentActionHandler(
    request,
    reply,
    "ready"
  );
}

export async function startPaymentProcessingHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  return paymentActionHandler(
    request,
    reply,
    "process"
  );
}

export async function markPaymentPaidHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  return paymentActionHandler(
    request,
    reply,
    "pay"
  );
}

// --- Payment analytics ---
export async function cashFlowForecastHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const forecast =
      await getCashFlowForecast();

    return reply.send({
      success: true,
      forecast,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error:
        "Failed to compute cash flow forecast",
    });
  }
}

export async function vendorPaymentPerformanceHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query = request.query as {
      vendorId?: string;
    };

    const performance =
      await getVendorPaymentPerformance(
        query.vendorId
          ? Number(query.vendorId)
          : undefined
      );

    return reply.send({
      success: true,
      performance,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error:
        "Failed to compute vendor payment performance",
    });
  }
}

export async function msmePaymentAlertsHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const alerts =
      await getMsmePaymentAlerts();

    return reply.send({
      success: true,
      alerts,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error:
        "Failed to fetch MSME payment alerts",
    });
  }
}
