"use client";

/**
 * PendingRequestsPanel
 * Purpose: Sidebar of requests awaiting the viewer's approval on the requests list.
 * Data: Client fetch to approvals/purchase-requests proxy endpoints.
 * Roles: request.approve.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "../lib/metrics";

type PendingRequest = {
  id: number;
  title: string;
  vendorName: string | null;
  requester: string;
  estimatedAmount: number;
  createdAt: string;
};

export default function PendingRequestsPanel({
  requests,
}: {
  requests: PendingRequest[];
}) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="mb-10 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 shadow-sm">
      <h2 className="mb-1 text-xl font-semibold text-amber-900">
        Awaiting Your Approval
      </h2>
      <p className="mb-6 text-sm text-amber-800">
        {requests.length} request
        {requests.length === 1 ? "" : "s"} need
        manager decision
      </p>

      <div className="space-y-4">
        {requests.map((req) => (
          <PendingRequestRow
            key={req.id}
            request={req}
          />
        ))}
      </div>
    </div>
  );
}

function PendingRequestRow({
  request,
}: {
  request: PendingRequest;
}) {
  const router = useRouter();
  const [loading, setLoading] =
    useState(false);

  async function submitAction(
    action: "approve" | "reject"
  ) {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/proxy/purchase-requests/${request.id}/${action}`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      let data: {
        error?: string;
        message?: string;
        success?: boolean;
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
    <div className="rounded-xl border border-amber-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            href={`/requests/${request.id}`}
            className="text-lg font-semibold text-blue-600 hover:underline"
          >
            {request.title}
          </Link>
          <p className="mt-1 text-sm text-gray-600">
            #{request.id} ·{" "}
            {request.vendorName ?? "—"} ·{" "}
            {formatMoney(
              request.estimatedAmount
            )}{" "}
            · {request.requester}
          </p>
        </div>

        <div className="flex shrink-0 gap-3">
          <button
            disabled={loading}
            onClick={() =>
              submitAction("approve")
            }
            className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={loading}
            onClick={() =>
              submitAction("reject")
            }
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
