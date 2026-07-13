/**
 * Module: RFQ (controller)
 * Purpose: HTTP handlers for RFQ CRUD, bids, scoring, award, savings, and PO generation.
 * Handlers:
 *   createRFQHandler, listRFQsHandler, getRFQHandler
 *   createBidHandler, listRFQBidsHandler, scoreRFQHandler
 *   getRFQRecommendationHandler, getRFQSavingsHandler
 *   openRFQHandler, awardVendorHandler, generatePOFromRFQHandler
 */
import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { auditContextFromRequest } from "../../lib/audit";
import { awardVendor, createRFQ, getRFQ, getRFQBids, getRFQRecommendation, getRFQSavings, listRFQs, openRFQ, scoreRFQ, submitBid } from "./rfq.service";
import { generatePOFromRFQ } from "../purchase-orders/poFromRFQ";

type CreateRFQBody = {
  title: string;
  description?: string;
  categoryId: number;
};

// --- Create RFQ ---
export async function createRFQHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body = request.body as CreateRFQBody;

    if (
      !body?.title?.trim() ||
      body?.categoryId == null ||
      !Number.isFinite(body.categoryId)
    ) {
      return reply.status(400).send({
        success: false,
        error: "title and categoryId required",
      });
    }

    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: "Authentication required",
      });
    }

    const rfq = await createRFQ({
      title: body.title.trim(),
      description: body.description?.trim(),
      categoryId: body.categoryId,
      createdById: user.id,
    });

    return reply.status(201).send({
      success: true,
      rfq,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to create RFQ",
    });
  }
}

// --- List and get RFQ ---
export async function listRFQsHandler(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const rfqs = await listRFQs();

    return reply.send({
      success: true,
      rfqs,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to list RFQs",
    });
  }
}

export async function getRFQHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string };
    const rfqId = Number(id);

    if (!Number.isFinite(rfqId)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid RFQ id",
      });
    }

    const rfq = await getRFQ(rfqId);

    return reply.send({
      success: true,
      rfq,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load RFQ";

    if (message === "RFQ not found") {
      return reply.status(404).send({
        success: false,
        error: message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: "Failed to load RFQ",
    });
  }
}

type CreateBidBody = {
  vendorId: number;
  quotedAmount: number;
  leadTimeDays: number;
  warrantyMonths: number;
  notes?: string;
};

// --- Vendor bids ---
export async function createBidHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string };
    const body = request.body as CreateBidBody;
    const rfqId = Number(id);

    if (
      !Number.isFinite(rfqId) ||
      body?.vendorId == null ||
      !Number.isFinite(body.vendorId) ||
      body?.quotedAmount == null ||
      !Number.isFinite(body.quotedAmount) ||
      body?.leadTimeDays == null ||
      !Number.isFinite(body.leadTimeDays) ||
      body?.warrantyMonths == null ||
      !Number.isFinite(body.warrantyMonths)
    ) {
      return reply.status(400).send({
        success: false,
        error:
          "vendorId, quotedAmount, leadTimeDays, warrantyMonths required",
      });
    }

    const bid = await submitBid({
      rfqId,
      vendorId: body.vendorId,
      quotedAmount: body.quotedAmount,
      leadTimeDays: body.leadTimeDays,
      warrantyMonths: body.warrantyMonths,
      notes: body.notes?.trim(),
    });

    return reply.status(201).send({
      success: true,
      bid,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to submit bid";

    if (message === "RFQ not found") {
      return reply.status(404).send({
        success: false,
        error: message,
      });
    }

    if (
      message === "RFQ no longer accepting bids" ||
      message === "Vendor not found"
    ) {
      return reply.status(400).send({
        success: false,
        error: message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: "Failed to submit bid",
    });
  }
}

export async function listRFQBidsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string };
    const rfqId = Number(id);

    if (!Number.isFinite(rfqId)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid RFQ id",
      });
    }

    const bids = await getRFQBids(rfqId);

    return reply.send({
      success: true,
      bids,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to list bids";

    if (message === "RFQ not found") {
      return reply.status(404).send({
        success: false,
        error: message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: "Failed to list bids",
    });
  }
}

// --- Scoring and recommendations ---
export async function scoreRFQHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string };
    const rfqId = Number(id);

    if (!Number.isFinite(rfqId)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid RFQ id",
      });
    }

    const bids = await scoreRFQ(rfqId);

    return reply.send({
      success: true,
      bids,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to score RFQ";

    if (message === "RFQ not found") {
      return reply.status(404).send({
        success: false,
        error: message,
      });
    }

    if (message === "No bids to score") {
      return reply.status(400).send({
        success: false,
        error: message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: "Failed to score RFQ",
    });
  }
}

export async function getRFQRecommendationHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string };
    const rfqId = Number(id);

    if (!Number.isFinite(rfqId)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid RFQ id",
      });
    }

    const result = await getRFQRecommendation(rfqId);

    return reply.send({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load recommendation";

    if (message === "RFQ not found") {
      return reply.status(404).send({
        success: false,
        error: message,
      });
    }

    if (message === "No bids to recommend") {
      return reply.status(400).send({
        success: false,
        error: message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: "Failed to load recommendation",
    });
  }
}

type AwardVendorBody = {
  vendorId: number;
};

// --- Open and award RFQ ---
export async function openRFQHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string };
    const rfqId = Number(id);
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: "Authentication required",
      });
    }

    if (!Number.isFinite(rfqId)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid RFQ id",
      });
    }

    const rfq = await openRFQ(
      rfqId,
      user.name,
      auditContextFromRequest({
        user,
        permission:
          request.permissionUsed ?? undefined,
      })
    );

    return reply.send({
      success: true,
      rfq,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to open RFQ";

    if (message === "RFQ not found") {
      return reply.status(404).send({
        success: false,
        error: message,
      });
    }

    if (
      message === "RFQ already awarded" ||
      message === "RFQ is closed"
    ) {
      return reply.status(400).send({
        success: false,
        error: message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: "Failed to open RFQ",
    });
  }
}

export async function awardVendorHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string };
    const body = request.body as AwardVendorBody;
    const rfqId = Number(id);
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: "Authentication required",
      });
    }

    if (
      !Number.isFinite(rfqId) ||
      body?.vendorId == null ||
      !Number.isFinite(body.vendorId)
    ) {
      return reply.status(400).send({
        success: false,
        error: "vendorId required",
      });
    }

    const rfq = await awardVendor(
      rfqId,
      body.vendorId,
      user.name,
      auditContextFromRequest({
        user,
        permission:
          request.permissionUsed ?? undefined,
      })
    );

    return reply.send({
      success: true,
      status: rfq.status,
      rfq,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to award vendor";

    if (message === "RFQ not found") {
      return reply.status(404).send({
        success: false,
        error: message,
      });
    }

    if (
      message === "RFQ already awarded" ||
      message === "RFQ is closed" ||
      message === "RFQ must be OPEN before awarding" ||
      message === "Vendor not eligible"
    ) {
      return reply.status(400).send({
        success: false,
        error: message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: "Failed to award vendor",
    });
  }
}

export async function getRFQSavingsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as { id: string };
    const rfqId = Number(id);

    if (!Number.isFinite(rfqId)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid RFQ id",
      });
    }

    const savings = await getRFQSavings(rfqId);

    return reply.send({
      success: true,
      highestBid: savings.highestBid,
      winningBid: savings.winningBid,
      savings: savings.savings,
      vendor: savings.vendor,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load savings";

    if (message === "RFQ not found") {
      return reply.status(404).send({
        success: false,
        error: message,
      });
    }

    if (message === "Savings not available") {
      return reply.status(404).send({
        success: false,
        error: message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: "Failed to load savings",
    });
  }
}

// --- Generate PO from awarded RFQ ---
export async function generatePOFromRFQHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params as {
      id: string;
    };
    const rfqId = Number(id);
    const user = request.user;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: "Authentication required",
      });
    }

    if (!Number.isFinite(rfqId)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid RFQ id",
      });
    }

    const po = await generatePOFromRFQ(
      rfqId,
      user.name
    );

    return reply.send({
      success: true,
      poNumber: po.poNumber,
      purchaseOrder: po,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate PO";

    if (message === "RFQ not found") {
      return reply.status(404).send({
        success: false,
        error: message,
      });
    }

    if (
      message ===
        "RFQ must be AWARDED before generating a PO" ||
      message === "RFQ has no awarded vendor" ||
      message ===
        "Winning bid not found for awarded vendor"
    ) {
      return reply.status(400).send({
        success: false,
        error: message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: "Failed to generate PO",
    });
  }
}
