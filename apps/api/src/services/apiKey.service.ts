/**
 * API Platform (Sprint 27).
 *
 * Tenant-scoped API keys for programmatic access. The full secret is shown
 * exactly once at creation; only a SHA-256 hash + a short display prefix are
 * stored. Verification is tenant-agnostic (an inbound key identifies its own
 * tenant), so it uses the raw client and re-applies tenant scoping downstream.
 */
import crypto from "node:crypto";
import prisma, { prismaRaw } from "../db";
import { recordAuditLog } from "../lib/audit";

const KEY_BYTES = 24;
const LIVE_PREFIX = "fsk_live_";

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Valid scopes an API key can be granted. */
export const API_SCOPES = [
  "read:vendors",
  "read:purchase-orders",
  "read:invoices",
  "read:contracts",
  "write:purchase-requests",
  "read:analytics",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function listAvailableScopes() {
  return API_SCOPES.map((s) => ({ key: s }));
}

export async function listApiKeys(tenantId: number) {
  return prisma.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdByName: true,
      createdAt: true,
    },
  });
}

export async function createApiKey(input: {
  tenantId: number;
  name: string;
  scopes: string[];
  expiresAt?: Date | null;
  actor: { id: number; name: string; role: string };
}) {
  const validScopes = input.scopes.filter((s) =>
    (API_SCOPES as readonly string[]).includes(s)
  );

  const secret = crypto.randomBytes(KEY_BYTES).toString("hex");
  const fullKey = `${LIVE_PREFIX}${secret}`;
  const keyPrefix = `${LIVE_PREFIX}${secret.slice(0, 6)}`;

  const created = await prisma.apiKey.create({
    data: {
      tenantId: input.tenantId,
      name: input.name.trim() || "Untitled key",
      keyPrefix,
      keyHash: hashKey(fullKey),
      scopes: validScopes,
      expiresAt: input.expiresAt ?? null,
      createdById: input.actor.id,
      createdByName: input.actor.name,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      createdAt: true,
    },
  });

  await recordAuditLog(
    "ApiKey",
    created.id,
    "API_KEY_CREATED",
    input.actor.name,
    {
      actorContext: { userId: input.actor.id, role: input.actor.role as never },
      newValue: { name: created.name, scopes: validScopes },
      metadata: { keyPrefix },
    }
  ).catch(() => {});

  // Secret is returned ONCE — never retrievable again.
  return { ...created, secret: fullKey };
}

export async function revokeApiKey(input: {
  tenantId: number;
  keyId: number;
  actor: { id: number; name: string; role: string };
}) {
  const key = await prisma.apiKey.findFirst({
    where: { id: input.keyId, tenantId: input.tenantId },
  });

  if (!key) {
    throw new Error("API key not found");
  }
  if (key.revokedAt) {
    return { id: key.id, alreadyRevoked: true };
  }

  await prisma.apiKey.update({
    where: { id: key.id },
    data: { revokedAt: new Date() },
  });

  await recordAuditLog(
    "ApiKey",
    key.id,
    "API_KEY_REVOKED",
    input.actor.name,
    {
      actorContext: { userId: input.actor.id, role: input.actor.role as never },
      metadata: { keyPrefix: key.keyPrefix },
    }
  ).catch(() => {});

  return { id: key.id, revoked: true };
}

/**
 * Verifies an inbound API key (tenant-agnostic). Returns the tenant + scopes
 * when valid and active. Used by API-key authenticated integrations.
 */
export async function verifyApiKey(rawKey: string) {
  if (!rawKey?.startsWith(LIVE_PREFIX)) return null;

  const record = await prismaRaw.apiKey.findUnique({
    where: { keyHash: hashKey(rawKey) },
  });

  if (!record || record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  await prismaRaw.apiKey
    .update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    tenantId: record.tenantId,
    scopes: record.scopes,
    keyId: record.id,
  };
}
