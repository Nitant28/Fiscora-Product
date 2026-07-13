/**
 * Shared Prisma client singleton for the API process.
 * Reuses one instance in development to avoid connection exhaustion on hot reload.
 */
import { PrismaClient } from "@prisma/client";
const prisma = global.prisma ??
    new PrismaClient();
// Persist client on global in non-production so Next/Fastify reloads share one pool
if (process.env.NODE_ENV !== "production") {
    global.prisma = prisma;
}
export default prisma;
