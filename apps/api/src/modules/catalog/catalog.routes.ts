/**
 * Module: Catalog
 * Purpose: Pre-approved catalog items and one-click ordering into purchase requests.
 * Endpoints:
 *   GET  /catalog
 *   POST /catalog/order
 *   POST /catalog
 */
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import {
  createCatalogItem,
  listCatalogItems,
  orderFromCatalog,
} from "../../services/catalog";
import {
  requireAuth,
  requirePermission,
} from "../../lib/authMiddleware";
import { PERMISSION_KEYS } from "../../lib/permissions";

export async function catalogRoutes(
  app: FastifyInstance
) {
  // --- List catalog items ---
  app.get(
    "/catalog",
    { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_VIEW) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { departmentId } =
          request.query as {
            departmentId?: string;
          };

        const items = await listCatalogItems(
          departmentId
            ? Number(departmentId)
            : undefined
        );

        return reply.send({
          success: true,
          items,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to load catalog",
        });
      }
    }
  );

  // --- Order from catalog ---
  app.post(
    "/catalog/order",
    { preHandler: requirePermission(PERMISSION_KEYS.REQUEST_CREATE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { catalogItemId, departmentId } =
          request.body as {
            catalogItemId?: number;
            departmentId?: number;
          };

        if (!catalogItemId) {
          return reply.status(400).send({
            success: false,
            error: "catalogItemId required",
          });
        }

        const result = await orderFromCatalog({
          catalogItemId,
          requester: request.user!.name,
          requesterId: request.user!.id,
          departmentId:
            departmentId ??
            request.user!.departmentId ??
            undefined,
        });

        return reply.status(201).send({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error
            ? error.message
            : "Order failed";

        return reply.status(400).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // --- Create catalog item ---
  app.post(
    "/catalog",
    { preHandler: requirePermission(PERMISSION_KEYS.CATALOG_MANAGE) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body =
          request.body as {
            name?: string;
            description?: string;
            vendorId?: number;
            price?: number;
            departmentId?: number;
          };

        if (
          !body.name?.trim() ||
          !body.vendorId ||
          body.price == null
        ) {
          return reply.status(400).send({
            success: false,
            error: "name, vendorId, price required",
          });
        }

        const item = await createCatalogItem({
          name: body.name.trim(),
          description: body.description,
          vendorId: body.vendorId,
          price: body.price,
          departmentId: body.departmentId,
          actor: request.user!.name,
        });

        return reply.status(201).send({
          success: true,
          item,
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to create catalog item",
        });
      }
    }
  );
}
