/**
 * Domain: API error tracking — persist exceptions with request correlation.
 */
import prisma from "../db";
import {
  getRequestContext,
  getRequestId,
  getRequestUserId,
} from "../lib/requestContext";

export type TrackErrorInput = {
  error: unknown;
  route?: string;
  method?: string;
  userId?: number | string | null;
  requestId?: string | null;
};

export async function trackError(input: TrackErrorInput) {
  const ctx = getRequestContext();
  const err =
    input.error instanceof Error
      ? input.error
      : new Error(String(input.error));

  const requestId =
    input.requestId ??
    getRequestId() ??
    ctx?.requestId ??
    null;

  const userIdRaw =
    input.userId ??
    getRequestUserId() ??
    ctx?.userId ??
    null;

  const userId =
    userIdRaw != null ? String(userIdRaw) : null;

  try {
    await prisma.errorLog.create({
      data: {
        requestId,
        userId,
        route: input.route ?? ctx?.route ?? "unknown",
        method: input.method ?? ctx?.method ?? "UNKNOWN",
        error: err.message,
        stack: err.stack ?? null,
      },
    });
  } catch (persistError) {
    console.error("Failed to persist ErrorLog:", persistError);
  }

  console.error(
    JSON.stringify({
      level: "error",
      requestId,
      userId,
      route: input.route ?? ctx?.route,
      method: input.method ?? ctx?.method,
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    })
  );
}

export async function listRecentErrors(limit = 50) {
  return prisma.errorLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listErrors(options?: {
  limit?: number;
  cursor?: string;
}) {
  const limit = Math.min(options?.limit ?? 50, 200);
  const cursor = options?.cursor;

  const rows = await prisma.errorLog.findMany({
    where: cursor
      ? {
          createdAt: {
            lt: (
              await prisma.errorLog.findUnique({
                where: { id: cursor },
                select: { createdAt: true },
              })
            )?.createdAt,
          },
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const errors = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? errors[errors.length - 1]?.id : null;

  return {
    errors,
    nextCursor,
    hasMore,
  };
}
