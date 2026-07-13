/**
 * Module: Vendor Portal (controller)
 */
import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { VendorDocType } from "@prisma/client";
import {
  getVendorDashboard,
  getVendorProfile,
  getVendorSession,
  loginVendor,
  updateVendorProfile,
  uploadVendorPortalDocument,
} from "./vendor-portal.service";

declare module "fastify" {
  interface FastifyRequest {
    vendor?: Awaited<ReturnType<typeof getVendorSession>>;
  }
}

function extractToken(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return null;
}

export async function requireVendorAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = extractToken(request);

  if (!token) {
    return reply.status(401).send({
      success: false,
      error: "Vendor authentication required",
    });
  }

  const vendor = await getVendorSession(token);

  if (!vendor) {
    return reply.status(401).send({
      success: false,
      error: "Invalid or expired vendor session",
    });
  }

  request.vendor = vendor;
}

export async function vendorLoginHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body = request.body as {
      email?: string;
      password?: string;
    };

    if (!body?.email?.trim() || !body?.password) {
      return reply.status(400).send({
        success: false,
        error: "email and password required",
      });
    }

    const result = await loginVendor(
      body.email.trim(),
      body.password
    );

    if (!result) {
      return reply.status(401).send({
        success: false,
        error: "Invalid vendor credentials",
      });
    }

    return reply.send({
      success: true,
      token: result.token,
      vendor: result.vendor,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Vendor login failed",
    });
  }
}

export async function vendorProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const profile = await getVendorProfile(
      request.vendor!.id
    );

    return reply.send({
      success: true,
      profile,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to load vendor profile",
    });
  }
}

export async function vendorUpdateProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body = request.body as {
      gstin?: string;
      pan?: string;
      bankAccount?: string;
      ifscCode?: string;
      msmeNumber?: string;
      contactPerson?: string;
    };

    const profile = await updateVendorProfile(
      request.vendor!.id,
      body
    );

    return reply.send({
      success: true,
      profile,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to update vendor profile",
    });
  }
}

export async function vendorDashboardHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const dashboard = await getVendorDashboard(
      request.vendor!.id
    );

    return reply.send({
      success: true,
      dashboard,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to load vendor dashboard",
    });
  }
}

export async function vendorUploadDocumentHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: "File required",
      });
    }

    const typeField = data.fields.type;
    const typeValue =
      typeField &&
      typeof typeField === "object" &&
      "value" in typeField
        ? String(typeField.value)
        : null;

    if (!typeValue) {
      return reply.status(400).send({
        success: false,
        error: "Document type required",
      });
    }

    const allowed: VendorDocType[] = [
      "GST",
      "PAN",
      "MSME",
      "BANK_ACCOUNT",
      "INSURANCE",
      "COMPLIANCE",
      "MSA",
      "NDA",
    ];

    if (!allowed.includes(typeValue as VendorDocType)) {
      return reply.status(400).send({
        success: false,
        error: "Invalid document type",
      });
    }

    const buffer = await data.toBuffer();
    const doc = await uploadVendorPortalDocument(
      request.vendor!.id,
      typeValue as VendorDocType,
      data.filename,
      buffer
    );

    return reply.status(201).send({
      success: true,
      document: doc,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({
      success: false,
      error: "Failed to upload document",
    });
  }
}
