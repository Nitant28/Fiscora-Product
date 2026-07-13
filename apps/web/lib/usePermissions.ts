"use client";

/**
 * Client RBAC hook for action-level authorization.
 */
import { useMemo } from "react";
import {
  can as canUser,
  type PermissionKey,
  type UserWithPermissions,
} from "./permissions";

export function usePermissions(
  user: UserWithPermissions | null | undefined
) {
  return useMemo(
    () => ({
      can: (permission: PermissionKey | string) =>
        canUser(user, permission),
    }),
    [user]
  );
}
