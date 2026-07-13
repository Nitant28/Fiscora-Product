"use client";

/**
 * PaymentActions
 * Purpose: Advance payment through approve, schedule, process, and complete states.
 * Data: POST /api/proxy/payments/:id/:action.
 * Roles: payment.approve, payment.process.
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
    id: "ready",
    label: "Mark Ready",
    statuses: ["SCHEDULED"],
    permission: PERMISSION_KEYS.PAYMENT_PROCESS,
  },
  {
    id: "process",
    label: "Process",
    statuses: ["READY"],
    permission: PERMISSION_KEYS.PAYMENT_PROCESS,
  },
  {
    id: "pay",
    label: "Mark Paid",
    statuses: ["PROCESSING"],
    permission: PERMISSION_KEYS.PAYMENT_MARK_PAID,
  },
] satisfies {
  id: string;
  label: string;
  statuses: string[];
  permission: PermissionKey;
}[];

export default function PaymentActions({
  paymentId,
  status,
  user,
}: {
  paymentId: number;
  status: string;
  user: UserWithPermissions | null;
}) {
  const router = useRouter();
  const { can } = usePermissions(user);
  const [loading, setLoading] =
    useState<string | null>(null);
  const [error, setError] = useState<
    string | null
  >(null);

  const visible = ACTIONS.filter((a) =>
    a.statuses.includes(status) &&
    can(a.permission)
  );

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">
          Payment Actions
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
      setError(null);

      const res = await fetch(
        `/api/proxy/payments/${paymentId}/${action}`,
        { method: "POST" }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ?? "Action failed"
        );
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Action failed"
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">
        Payment Actions
      </h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

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

      <p className="mt-4 text-xs text-gray-500">
        Flow: SCHEDULED → READY → PROCESSING →
        PAID (no skipping)
      </p>
    </div>
  );
}
