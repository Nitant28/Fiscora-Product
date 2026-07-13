"use client";

/**
 * POActions
 * Purpose: Send PO to vendor, record acceptance, and transition PO status.
 * Data: POST /api/proxy/purchase-orders/:id/:action.
 * Roles: po.send, po.manage.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PERMISSION_KEYS,
  type PermissionKey,
  type UserWithPermissions,
} from "../lib/permissions";
import { usePermissions } from "../lib/usePermissions";

const ACTIONS = [
  {
    id: "send",
    label: "Send PO",
    statuses: ["DRAFT"],
    permission: PERMISSION_KEYS.PO_SEND,
  },
  {
    id: "accept",
    label: "Accept PO",
    statuses: ["SENT"],
    permission: PERMISSION_KEYS.PO_MANAGE,
  },
  {
    id: "close",
    label: "Close PO",
    statuses: ["RECEIVED", "PARTIALLY_RECEIVED"],
    permission: PERMISSION_KEYS.PO_MANAGE,
  },
] satisfies {
  id: string;
  label: string;
  statuses: string[];
  permission: PermissionKey;
}[];

export default function POActions({
  poId,
  status,
  user,
}: {
  poId: number;
  status: string;
  user: UserWithPermissions | null;
}) {
  const router = useRouter();
  const { can } = usePermissions(user);
  const [loading, setLoading] =
    useState<string | null>(null);

  const visible = ACTIONS.filter((a) =>
    a.statuses.includes(status) &&
    can(a.permission)
  );

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">
          PO Lifecycle
        </h2>
        <p className="text-sm text-gray-500">
          No actions available for status{" "}
          <span className="font-medium">
            {status}
          </span>
          .
        </p>
      </div>
    );
  }

  async function runAction(
    action: string
  ) {
    try {
      setLoading(action);

      const res = await fetch(
        `/api/proxy/purchase-orders/${poId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ?? "Action failed"
        );
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Action failed"
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">
        PO Lifecycle
      </h2>
      <div className="flex flex-wrap gap-3">
        {visible.map((action) => (
          <button
            key={action.id}
            disabled={loading != null}
            onClick={() =>
              runAction(action.id)
            }
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === action.id
              ? "..."
              : action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
