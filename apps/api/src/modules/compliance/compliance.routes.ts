/**
 * Module: Compliance — GST intelligence and vendor risk center APIs.
 */
import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";
import {
  getComplianceGstRecords,
  getComplianceRisks,
  getComplianceVendors,
  getVendorComplianceProfile,
} from "./compliance.service";

export async function complianceRoutes(
  app: FastifyInstance
) {
  app.get(
    "/compliance/vendors",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.COMPLIANCE_VIEW),
      ],
    },
    async () => {
      return getComplianceVendors();
    }
  );

  app.get(
    "/compliance/vendor/:id",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.COMPLIANCE_VIEW),
      ],
    },
    async (request, reply) => {
      const id = Number(
        (request.params as { id: string }).id
      );

      if (!Number.isFinite(id)) {
        return reply.status(400).send({
          error: "Invalid vendor id",
        });
      }

      const profile =
        await getVendorComplianceProfile(id);

      if (!profile) {
        return reply.status(404).send({
          error: "Vendor not found",
        });
      }

      return profile;
    }
  );

  app.get(
    "/compliance/gst",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.COMPLIANCE_VIEW),
      ],
    },
    async () => {
      return getComplianceGstRecords();
    }
  );

  app.get(
    "/compliance/risks",
    {
      preHandler: [
        requirePermission(PERMISSION_KEYS.COMPLIANCE_VIEW),
      ],
    },
    async () => {
      return getComplianceRisks();
    }
  );
}
