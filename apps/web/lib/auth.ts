/**
 * Public auth/RBAC surface for app code.
 * Re-exports from permissions.ts so pages and components can import
 * from "@/lib/auth" without reaching into the permissions module directly.
 */

export {
  PERMISSION_KEYS,
  can,
  hasPermission,
  canViewCfoDashboard,
  canManageContracts,
  canViewExecutiveDashboard,
  canViewSavingsIntelligence,
  canAccessRoute,
  type PermissionKey,
  type UserWithPermissions,
} from "./permissions";
