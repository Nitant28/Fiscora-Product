"use client";

/**
 * RequestActions
 * Purpose: Approve or reject a purchase request from its detail page.
 * Data: POST /api/proxy/purchase-requests/:id/:action.
 * Roles: request.approve.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PERMISSION_KEYS,
  type UserWithPermissions,
} from "../lib/permissions";
import { usePermissions } from "../lib/usePermissions";

export default function RequestActions({
  requestId,
  user,
}: {
  requestId: number;
  user: UserWithPermissions | null;
}) {
  const router = useRouter();
  const { can } = usePermissions(user);
  const [loading, setLoading] =
    useState(false);
  const canApprove = can(PERMISSION_KEYS.REQUEST_APPROVE);
  const canReject = can(PERMISSION_KEYS.REQUEST_REJECT);

  if (!canApprove && !canReject) {
    return null;
  }

  async function submitAction(
    action: "approve" | "reject"
  ) {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/proxy/purchase-requests/${requestId}/${action}`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      let data: {
        error?: string;
        message?: string;
      } = {};

      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(
          data.error ??
            data.message ??
            `Failed to update request (${res.status})`
        );
      }

      router.push("/requests");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update request"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-amber-900">
        Manager Approval
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {canApprove && (
          <button
            disabled={loading}
            onClick={() =>
              submitAction("approve")
            }
            className="rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve
          </button>
        )}
        {canReject && (
          <button
            disabled={loading}
            onClick={() =>
              submitAction("reject")
            }
            className="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
