"use client";

/**
 * ApprovalInboxActions
 * Purpose: Approve or reject purchase requests from the approvals inbox.
 * Data: POST /api/proxy/purchase-requests/:id/:action.
 * Roles: request.approve.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "../lib/metrics";
import {
  PERMISSION_KEYS,
  type UserWithPermissions,
} from "../lib/permissions";
import { usePermissions } from "../lib/usePermissions";

type InboxRequest = {
  id: number;
  title: string;
  vendorName: string | null;
  estimatedAmount: number;
  requester: string;
  department?: { name: string } | null;
  assignedApprover?: string | null;
  slaDueAt?: string | null;
};

export default function ApprovalInboxActions({
  requests,
  user,
}: {
  requests: InboxRequest[];
  user: UserWithPermissions | null;
  approver?: string;
}) {
  const router = useRouter();
  const { can } = usePermissions(user);
  const [loading, setLoading] =
    useState<number | null>(null);
  const canApprove = can(PERMISSION_KEYS.REQUEST_APPROVE);
  const canReject = can(PERMISSION_KEYS.REQUEST_REJECT);

  if (requests.length === 0 || (!canApprove && !canReject)) {
    return null;
  }

  async function act(
    id: number,
    action: "approve" | "reject"
  ) {
    try {
      setLoading(id);
      const res = await fetch(
        `/api/proxy/purchase-requests/${id}/${action}`,
        { method: "PATCH" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ?? "Action failed"
        );
      }
      router.refresh();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Action failed"
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <div
          key={req.id}
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href={`/requests/${req.id}`}
                className="text-lg font-semibold text-blue-600 hover:underline"
              >
                {req.title}
              </Link>
              <p className="mt-1 text-sm text-gray-600">
                {formatMoney(req.estimatedAmount)} ·{" "}
                {req.vendorName ?? "—"} ·{" "}
                {req.department?.name ?? "No dept"}
              </p>
              {req.slaDueAt && (
                <p className="mt-1 text-xs text-amber-700">
                  SLA due:{" "}
                  {new Date(
                    req.slaDueAt
                  ).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              {canApprove && (
                <button
                  disabled={loading === req.id}
                  onClick={() =>
                    act(req.id, "approve")
                  }
                  className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {canReject && (
                <button
                  disabled={loading === req.id}
                  onClick={() =>
                    act(req.id, "reject")
                  }
                  className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
