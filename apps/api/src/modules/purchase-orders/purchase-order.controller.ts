/**
 * Module: Purchase Orders (controller)
 * Purpose: HTTP handlers for PO CRUD, lifecycle transitions, goods receipt, and invoice matching.
 * Handlers:
 *   listPOsHandler, getPOHandler, generatePOHandler
 *   sendPOHandler, markAcceptedHandler, markReceivedHandler, closePOHandler
 *   matchInvoiceHandler, listGoodsReceiptsHandler, createGoodsReceiptHandler
 */
import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { auditContextFromRequest } from "../../lib/audit";
import {
  closePO,
  generatePOFromRequest,
  getPO,
  getThreeWayMatchForInvoice,
  listPOs,
  markAccepted,
  markReceived,
  matchInvoice,
  sendPO,
} from "./purchase-order.service";
import {
  createGoodsReceipt,
  listGoodsReceipts,
} from "../../services/goodsReceipt";
import { performThreeWayMatch } from "../../services/threeWayMatch";
import { schedulePaymentIfMatched } from "../../services/paymentEngine";
import prisma from "../../db";

// --- Internal helpers ---
function poErrorStatus(message: string) {
  if (
    message === "Purchase order not found"
  ) {
    return 404;
  }

  if (message.includes("Invalid PO transition")) {
    return 400;
  }

  return 500;
}

// --- List and get purchase orders ---
export async function listPOsHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const orders = await listPOs();
    return reply.send({
      success: true,
      purchaseOrders: orders,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to list purchase orders",
    });
  }
}

export async function getPOHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };

    const po = await getPO(Number(id));

    if (!po) {
      return reply.status(404).send({
        success: false,
        error: "Purchase order not found",
      });
    }

    return reply.send({
      success: true,
      purchaseOrder: po,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to load purchase order",
    });
  }
}

// --- Generate PO from purchase request ---
export async function generatePOHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { requestId } =
      request.params as {
        requestId: string;
      };

    const body =
      request.body as { actor?: string };

    const po =
      await generatePOFromRequest(
        Number(requestId),
        body?.actor ?? "Manager"
      );

    return reply.status(201).send({
      success: true,
      purchaseOrder: po,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate PO";

    return reply.status(400).send({
      success: false,
      error: message,
    });
  }
}

// --- PO lifecycle transitions ---
export async function sendPOHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };
    const body =
      request.body as { actor?: string };

    const po = await sendPO(
      Number(id),
      request.user?.name ??
        body?.actor ??
        "Manager",
      auditContextFromRequest({
        user: request.user ?? null,
        permission:
          request.permissionUsed ?? undefined,
      })
    );

    return reply.send({
      success: true,
      purchaseOrder: po,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to send PO";

    return reply.status(
      poErrorStatus(message)
    ).send({
      success: false,
      error: message,
    });
  }
}

export async function markAcceptedHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };
    const body =
      request.body as { actor?: string };

    const po = await markAccepted(
      Number(id),
      body?.actor ?? "Manager"
    );

    return reply.send({
      success: true,
      purchaseOrder: po,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to mark PO accepted";

    return reply.status(
      poErrorStatus(message)
    ).send({
      success: false,
      error: message,
    });
  }
}

export async function markReceivedHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };
    const body =
      request.body as { actor?: string };

    const po = await markReceived(
      Number(id),
      body?.actor ?? "Manager"
    );

    return reply.send({
      success: true,
      purchaseOrder: po,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to mark PO received";

    return reply.status(
      poErrorStatus(message)
    ).send({
      success: false,
      error: message,
    });
  }
}

export async function closePOHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };
    const body =
      request.body as { actor?: string };

    const po = await closePO(
      Number(id),
      body?.actor ?? "Manager"
    );

    return reply.send({
      success: true,
      purchaseOrder: po,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to close PO";

    return reply.status(
      poErrorStatus(message)
    ).send({
      success: false,
      error: message,
    });
  }
}

// --- Invoice PO match ---
export async function matchInvoiceHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { documentId } =
      request.params as {
        documentId: string;
      };

    const result = await matchInvoice(
      Number(documentId)
    );

    const threeWayMatch =
      await getThreeWayMatchForInvoice(
        Number(documentId)
      );

    return reply.send({
      success: true,
      ...result,
      threeWayMatch,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to match invoice",
    });
  }
}

// --- Goods receipts ---
export async function listGoodsReceiptsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };

    const receipts =
      await listGoodsReceipts(Number(id));

    return reply.send({
      success: true,
      receipts,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to list goods receipts",
    });
  }
}

export async function createGoodsReceiptHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } =
      request.params as { id: string };
    const body = request.body as {
      quantityReceived?: number;
      orderedQuantity?: number;
      notes?: string;
    };
    const user = (request as any).user;

    if (
      body?.quantityReceived == null ||
      !Number.isFinite(body.quantityReceived)
    ) {
      return reply.status(400).send({
        success: false,
        error: "quantityReceived required",
      });
    }

    const receipt =
      await createGoodsReceipt({
        purchaseOrderId: Number(id),
        quantityReceived:
          body.quantityReceived,
        orderedQuantity:
          body.orderedQuantity,
        receivedById: user?.id ?? 1,
        notes: body.notes,
      });

    const po = await prisma.purchaseOrder.findUnique(
      {
        where: { id: Number(id) },
        include: {
          invoices: {
            select: { id: true },
          },
        },
      }
    );

    if (po?.invoices.length) {
      for (const inv of po.invoices) {
        await performThreeWayMatch(
          po.id,
          inv.id
        );
        await schedulePaymentIfMatched(
          inv.id
        );
      }
    }

    const updatedPo = await getPO(Number(id));

    return reply.status(201).send({
      success: true,
      receipt,
      purchaseOrder: updatedPo,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to record goods receipt";

    return reply.status(
      message === "Purchase order not found"
        ? 404
        : 400
    ).send({
      success: false,
      error: message,
    });
  }
}
