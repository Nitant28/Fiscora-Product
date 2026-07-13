/**
 * Shared Prisma client singleton for the API process.
 * `prisma` auto-scopes queries to the active tenant; `prismaRaw` bypasses isolation (auth/seeds).
 */
import { PrismaClient } from "@prisma/client";
import { extendWithTenant, type TenantPrismaClient } from "./lib/prismaTenant";

declare global {
  var prismaRaw: PrismaClient | undefined;
  var prisma: TenantPrismaClient | undefined;
}

const prismaRaw = global.prismaRaw ?? new PrismaClient();
const prisma = global.prisma ?? extendWithTenant(prismaRaw);

if (process.env.NODE_ENV !== "production") {
  global.prismaRaw = prismaRaw;
  global.prisma = prisma;
}

export { prismaRaw };
export default prisma;
