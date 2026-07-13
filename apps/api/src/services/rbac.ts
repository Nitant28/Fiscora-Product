/**
 * Domain: Access control — role-permission cache, seeding, and permission checks.
 * Main exports: refreshRbacCache, seedRbacPermissions, getPermissionsForRole, hasPermission, listAllPermissions.
 * Called by: lib/auth.ts, lib/seed.ts; scripts/verify-rbac.ts.
 */
import type { UserRole } from "@prisma/client";
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";
import {
  ALL_PERMISSIONS,
  normalizePermissionKey,
  ROLE_PERMISSION_MATRIX,
  type PermissionKey,
} from "../lib/permissions";

let rolePermissionCache: Map<UserRole, Set<string>> =
  new Map();
let permissionRoleCache: Map<string, Set<UserRole>> =
  new Map();

export async function refreshRbacCache() {
  const mappings =
    await prisma.rolePermission.findMany({
      include: { permission: true },
    });

  const next = new Map<UserRole, Set<string>>();
  const reverse = new Map<string, Set<UserRole>>();

  for (const mapping of mappings) {
    const existing =
      next.get(mapping.role) ?? new Set<string>();
    existing.add(mapping.permission.key);
    next.set(mapping.role, existing);

    const roles =
      reverse.get(mapping.permission.key) ??
      new Set<UserRole>();
    roles.add(mapping.role);
    reverse.set(mapping.permission.key, roles);
  }

  rolePermissionCache = next;
  permissionRoleCache = reverse;
}

/* --- SEED & CACHE --- */

export async function seedRbacPermissions() {
  for (const permission of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { description: permission.description },
    });
  }

  const permissions =
    await prisma.permission.findMany();
  const byKey = new Map(
    permissions.map((p) => [p.key, p.id])
  );

  for (const [role, keys] of Object.entries(
    ROLE_PERMISSION_MATRIX
  )) {
    for (const key of keys) {
      const permissionId = byKey.get(key);
      if (!permissionId) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: role as UserRole,
            permissionId,
          },
        },
        create: {
          role: role as UserRole,
          permissionId,
        },
        update: {},
      });
    }
  }

  await refreshRbacCache();
}

/* --- AUTHORIZATION --- */

export function getPermissionsForRole(
  role: UserRole
): string[] {
  const fallback =
    ROLE_PERMISSION_MATRIX[role] ?? [];
  const cached = rolePermissionCache.get(role);

  // When the DB cache is loaded it is AUTHORITATIVE (so admins can remove
  // seeded permissions via the editable matrix). ADMIN always retains the full
  // set as a safety net against accidental lockout.
  if (cached) {
    if (role === "ADMIN") {
      return [...new Set([...cached, ...fallback])];
    }
    return [...cached];
  }

  return fallback;
}

export function hasPermission(
  role: UserRole,
  permission: string
): boolean {
  const key = normalizePermissionKey(permission);
  const cached = rolePermissionCache.get(role);

  if (cached) {
    return cached.has(key);
  }

  const fallback =
    ROLE_PERMISSION_MATRIX[role] ?? [];
  return fallback.includes(key as PermissionKey);
}

export function getRolesForPermission(
  permission: string
): UserRole[] {
  const key = normalizePermissionKey(permission);
  const cached = permissionRoleCache.get(key);

  if (cached) {
    return [...cached];
  }

  return Object.entries(ROLE_PERMISSION_MATRIX)
    .filter(([, permissions]) =>
      permissions.includes(key as PermissionKey)
    )
    .map(([role]) => role as UserRole);
}

export async function getUserPermissions(
  userId: number
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return [];
  }

  return getPermissionsForRole(user.role);
}

export async function hasUserPermission(
  userId: number,
  permission: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    return false;
  }

  return hasPermission(user.role, permission);
}

export async function assignRole(
  userId: number,
  role: UserRole
) {
  return prisma.user.update({
    where: { id: userId },
    data: { role },
  });
}

export async function assignPermission(
  role: UserRole,
  permission: string
) {
  const key = normalizePermissionKey(permission);
  const record = await prisma.permission.upsert({
    where: { key },
    create: {
      key,
      description: `Custom permission: ${key}`,
    },
    update: {},
  });

  const mapping = await prisma.rolePermission.upsert({
    where: {
      role_permissionId: {
        role,
        permissionId: record.id,
      },
    },
    create: {
      role,
      permissionId: record.id,
    },
    update: {},
  });

  await refreshRbacCache();
  return mapping;
}

export async function listAllPermissions() {
  return prisma.permission.findMany({
    orderBy: { key: "asc" },
  });
}

/* --- DYNAMIC RBAC (editable + audited, Sprint 21) --- */

/** Roles that cannot be edited from the matrix (prevents admin lockout). */
const PROTECTED_ROLES: UserRole[] = ["ADMIN"];

/**
 * Grants or revokes a permission for a role, writes an audit record, and
 * refreshes the in-memory cache so the change takes effect immediately —
 * no code deployment required.
 */
export async function setRolePermission(input: {
  role: UserRole;
  permissionKey: string;
  enabled: boolean;
  actor: { id: number; name: string; role: UserRole };
}) {
  const { role, enabled, actor } = input;
  const key = normalizePermissionKey(input.permissionKey);

  if (PROTECTED_ROLES.includes(role)) {
    throw new Error(
      "The ADMIN role is protected and cannot be edited"
    );
  }

  const permission = await prisma.permission.upsert({
    where: { key },
    create: { key, description: `Permission: ${key}` },
    update: {},
  });

  const wasGranted = hasPermission(role, key);

  if (enabled) {
    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role,
          permissionId: permission.id,
        },
      },
      create: { role, permissionId: permission.id },
      update: {},
    });
  } else {
    await prisma.rolePermission.deleteMany({
      where: { role, permissionId: permission.id },
    });
  }

  await refreshRbacCache();

  await recordAuditLog(
    "RolePermission",
    permission.id,
    enabled ? "PERMISSION_GRANTED" : "PERMISSION_REVOKED",
    actor.name,
    {
      actorContext: { userId: actor.id, role: actor.role },
      oldValue: { role, permission: key, granted: wasGranted },
      newValue: { role, permission: key, granted: enabled },
      metadata: { role, permission: key },
    }
  ).catch(() => {});

  return {
    role,
    permission: key,
    enabled,
    changed: wasGranted !== enabled,
  };
}

export function isRbacCacheLoaded(): boolean {
  return rolePermissionCache.size > 0;
}

/* --- PERMISSION MATRIX (read model for admin viewer) --- */

/**
 * Returns the live Role × Permission matrix sourced from the RBAC engine
 * (DB-backed cache, falling back to the seed matrix). This is the transparent
 * "who can do what" view — proof that authorization is data-driven, not hardcoded.
 */
export async function getPermissionMatrix() {
  if (!isRbacCacheLoaded()) {
    await refreshRbacCache();
  }

  const roles = Object.keys(
    ROLE_PERMISSION_MATRIX
  ) as UserRole[];

  const permissions = ALL_PERMISSIONS.map((p) => ({
    key: p.key,
    description: p.description,
    grantedTo: roles.filter((role) =>
      hasPermission(role, p.key)
    ),
  }));

  const matrix: Record<string, string[]> = {};
  for (const role of roles) {
    matrix[role] = getPermissionsForRole(role).sort();
  }

  return {
    roles,
    permissions,
    matrix,
    totalPermissions: ALL_PERMISSIONS.length,
    source: isRbacCacheLoaded()
      ? "database"
      : "seed-matrix",
  };
}
