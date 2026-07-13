/**
 * Module: Vendor Portal
 * Endpoints:
 *   POST /vendor/login
 *   GET  /vendor/profile
 *   PATCH /vendor/profile
 *   POST /vendor/documents
 *   GET  /vendor/dashboard
 */
import type { FastifyInstance } from "fastify";
import {
  requireVendorAuth,
  vendorDashboardHandler,
  vendorLoginHandler,
  vendorProfileHandler,
  vendorUpdateProfileHandler,
  vendorUploadDocumentHandler,
} from "./vendor-portal.controller";

export async function vendorPortalRoutes(
  app: FastifyInstance
) {
  app.post("/vendor/login", vendorLoginHandler);

  app.get(
    "/vendor/profile",
    { preHandler: requireVendorAuth },
    vendorProfileHandler
  );

  app.patch(
    "/vendor/profile",
    { preHandler: requireVendorAuth },
    vendorUpdateProfileHandler
  );

  app.post(
    "/vendor/documents",
    { preHandler: requireVendorAuth },
    vendorUploadDocumentHandler
  );

  app.get(
    "/vendor/dashboard",
    { preHandler: requireVendorAuth },
    vendorDashboardHandler
  );
}
