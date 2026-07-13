"use client";

/**
 * ContractRenewalActions
 * Purpose: Renewal queue actions — renew, review, terminate.
 * Data: POST /api/proxy/contracts/:id/:action.
 * Roles: contract.manage.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PERMISSION_KEYS,
  type UserWithPermissions,
} from "../lib/permissions";
import { usePermissions } from "../lib/usePermissions";

export default function ContractRenewalActions({
  contractId,
  user,
}: {
  contractId: number;
  user: UserWithPermissions | null;
}) {
  const router = useRouter();
  const { can } = usePermissions(user);
  const canManage = can(PERMISSION_KEYS.CONTRACT_MANAGE);
  const [loading, setLoading] = useState<
    string | null
  >(null);
  const [error, setError] = useState<
    string | null
  >(null);

  async function runAction(action: string) {
    if (!canManage) {
      return;
    }

    setLoading(action);
    setError(null);

    try {
      const res = await fetch(
        `/api/proxy/contracts/${contractId}/${action}`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Action failed"
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

  if (!canManage) {
    return (
      <span className="text-xs text-gray-400">
        View only
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={loading != null}
        onClick={() => runAction("renew")}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading === "renew"
          ? "…"
          : "Renew"}
      </button>
      <button
        type="button"
        disabled={loading != null}
        onClick={() => runAction("review")}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading === "review"
          ? "…"
          : "Review"}
      </button>
      <button
        type="button"
        disabled={loading != null}
        onClick={() => runAction("terminate")}
        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {loading === "terminate"
          ? "…"
          : "Terminate"}
      </button>
      {error && (
        <span className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
