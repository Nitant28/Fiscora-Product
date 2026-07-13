/**
 * Module: Vendor Onboarding
 * Purpose: Vendor invite, self-service document upload, review, and activation.
 * Endpoints:
 *   POST  /vendor-onboarding/invite
 *   GET   /vendor-onboarding/pending
 *   PATCH /vendor-onboarding/review/:vendorId/activate
 *   GET   /vendor-onboarding/:token
 *   POST  /vendor-onboarding/:token/upload
 *   POST  /vendor-onboarding/:token/submit
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import {
  activateVendor,
  getInviteByToken,
  inviteVendor,
  listPendingVendors,
  submitVendorForReview,
  uploadVendorDocument,
  REQUIRED_DOCS,
} from "../../services/vendorOnboarding";
import { PERMISSION_KEYS } from "../../lib/permissions";
import {
  requirePermission,
} from "../../lib/authMiddleware";
import type { VendorDocType } from "@prisma/client";
import prisma from "../../db";

export async function vendorOnboardingRoutes(
  app: FastifyInstance
) {
  // --- Admin: invite vendor ---
  app.post(
    "/vendor-onboarding/invite",
    { preHandler: requirePermission(PERMISSION_KEYS.VENDOR_INVITE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email, vendorName } =
          request.body as {
            email?: string;
            vendorName?: string;
          };

        if (!email?.trim() || !vendorName?.trim()) {
          return reply.status(400).send({
            success: false,
            error: "email and vendorName required",
          });
        }

        const result = await inviteVendor(
          email.trim(),
          vendorName.trim(),
          request.user!.name
        );

        return reply.status(201).send({
          success: true,
          inviteToken: result.invite.token,
          inviteUrl: `/vendor-onboarding/${result.invite.token}`,
          vendor: result.vendor,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to invite vendor",
        });
      }
    }
  );

  // --- Admin: list pending vendors ---
  app.get(
    "/vendor-onboarding/pending",
    { preHandler: requirePermission(PERMISSION_KEYS.VENDOR_MANAGE) },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const vendors =
          await listPendingVendors();

        return reply.send({
          success: true,
          vendors,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to list pending vendors",
        });
      }
    }
  );

  // --- Admin: activate vendor ---
  app.patch(
    "/vendor-onboarding/review/:vendorId/activate",
    { preHandler: requirePermission(PERMISSION_KEYS.VENDOR_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { vendorId } =
          request.params as { vendorId: string };

        const body =
          (request.body ?? {}) as {
            paymentTermsDays?: number;
            msmeRegistered?: boolean;
          };

        const vendor = await activateVendor(
          Number(vendorId),
          request.user!.name,
          {
            paymentTermsDays:
              body.paymentTermsDays,
            msmeRegistered:
              body.msmeRegistered,
          }
        );

        return reply.send({
          success: true,
          vendor,
        });
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error
            ? error.message
            : "Activation failed";

        return reply.status(400).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // --- Public: load invite ---
  app.get(
    "/vendor-onboarding/:token",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token } =
          request.params as { token: string };

        const invite =
          await getInviteByToken(token);

        if (!invite || invite.expiresAt < new Date()) {
          return reply.status(404).send({
            success: false,
            error: "Invite not found or expired",
          });
        }

        return reply.send({
          success: true,
          invite,
          requiredDocs: REQUIRED_DOCS,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to load invite",
        });
      }
    }
  );

  // --- Public: upload vendor document ---
  app.post(
    "/vendor-onboarding/:token/upload",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token } =
          request.params as { token: string };

        const invite =
          await getInviteByToken(token);

        if (!invite?.vendorId) {
          return reply.status(404).send({
            success: false,
            error: "Invalid invite",
          });
        }

        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            success: false,
            error: "File required",
          });
        }

        const docType = (
          data.fields.docType as { value?: string }
        )?.value as VendorDocType;

        if (!docType) {
          return reply.status(400).send({
            success: false,
            error: "docType required",
          });
        }

        const buffer = await data.toBuffer();

        const doc = await uploadVendorDocument(
          invite.vendorId,
          docType,
          data.filename,
          buffer
        );

        return reply.send({
          success: true,
          document: doc,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Upload failed",
        });
      }
    }
  );

  // --- Public: submit vendor for review ---
  app.post(
    "/vendor-onboarding/:token/submit",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token } =
          request.params as { token: string };

        const invite =
          await getInviteByToken(token);

        if (!invite?.vendorId) {
          return reply.status(404).send({
            success: false,
            error: "Invalid invite",
          });
        }

        const body =
          request.body as {
            gstNumber?: string;
            panNumber?: string;
            bankAccount?: string;
            contactPerson?: string;
          };

        const validation =
          await submitVendorForReview(
            invite.vendorId,
            body
          );

        await prisma.vendorInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        });

        return reply.send({
          success: true,
          validation,
        });
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error
            ? error.message
            : "Submit failed";

        return reply.status(400).send({
          success: false,
          error: message,
        });
      }
    }
  );
}
