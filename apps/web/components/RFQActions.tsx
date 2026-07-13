"use client";

/**
 * RFQActions
 * Purpose: RFQ lifecycle actions (publish, close, cancel) from detail views.
 * Data: POST /api/proxy/rfqs/:id/:action.
 * Roles: rfq.manage.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PERMISSION_KEYS,
  type PermissionKey,
  type UserWithPermissions,
} from "../lib/permissions";
import { usePermissions } from "../lib/usePermissions";

type ActionDef = {
  id: string;
  label: string;
  enabled: boolean;
  hint?: string;
  body?: object;
  permission: PermissionKey;
};

export default function RFQActions({
  rfqId,
  status,
  recommendedVendorId,
  bidCount,
  hasScores,
  hasPO,
  onGeneratePO,
  generatingPO,
  user,
}: {
  rfqId: number;
  status: string;
  recommendedVendorId?: number | null;
  bidCount: number;
  hasScores: boolean;
  hasPO: boolean;
  onGeneratePO?: () => void;
  generatingPO?: boolean;
  user: UserWithPermissions | null;
}) {
  const router = useRouter();
  const { can } = usePermissions(user);
  const [loading, setLoading] = useState<
    string | null
  >(null);
  const [error, setError] = useState<
    string | null
  >(null);

  async function callAction(
    action: string,
    body?: object
  ) {
    setError(null);
    setLoading(action);

    try {
      const res = await fetch(
        `/api/proxy/rfqs/${rfqId}/${action}`,
        {
          method: "POST",
          headers: body
            ? {
                "Content-Type":
                  "application/json",
              }
            : undefined,
          body: body
            ? JSON.stringify(body)
            : undefined,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            `Failed: ${action}`
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

  const isAwarded = status === "AWARDED";
  const isClosed = status === "CLOSED";
  const isOpen = status === "OPEN";

  const actions: ActionDef[] = [
    {
      id: "score",
      label: "Score Bids",
      enabled:
        !isAwarded &&
        !isClosed &&
        bidCount > 0,
      permission: PERMISSION_KEYS.RFQ_MANAGE,
      hint:
        bidCount === 0
          ? "Submit bids first"
          : undefined,
    },
    {
      id: "open",
      label: "Open RFQ",
      enabled:
        !isAwarded &&
        !isClosed &&
        !isOpen &&
        hasScores,
      permission: PERMISSION_KEYS.RFQ_OPEN,
      hint: !hasScores
        ? "Score bids first"
        : undefined,
    },
    {
      id: "award",
      label: "Award Vendor",
      enabled:
        isOpen &&
        recommendedVendorId != null,
      permission: PERMISSION_KEYS.RFQ_AWARD,
      hint: !isOpen
        ? "Open RFQ first"
        : recommendedVendorId == null
          ? "Score bids first"
          : undefined,
      body:
        recommendedVendorId != null
          ? {
              vendorId:
                recommendedVendorId,
            }
          : undefined,
    },
  ];

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">
        Procurement Actions
      </h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {actions.filter((action) => can(action.permission)).map((action) => (
          <button
            key={action.id}
            disabled={
              !action.enabled ||
              loading !== null
            }
            title={action.hint}
            onClick={() =>
              action.enabled &&
              callAction(
                action.id,
                action.body
              )
            }
            className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              action.id === "score"
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : action.id === "open"
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {loading === action.id
              ? "..."
              : action.label}
          </button>
        ))}

        {can(PERMISSION_KEYS.PO_CREATE) && (
          <button
            disabled={
              !isAwarded ||
              hasPO ||
              generatingPO ||
              loading !== null
            }
            title={
              !isAwarded
                ? "Award vendor first"
                : hasPO
                  ? "PO already generated"
                  : undefined
            }
            onClick={onGeneratePO}
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generatingPO
              ? "Generating..."
              : "Generate PO"}
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
        {actions.filter((a) => can(a.permission)).map((a) => (
          <span key={a.id}>
            {a.label}:{" "}
            {a.enabled ? "✓ ready" : "— locked"}
          </span>
        ))}
        <span>
          Generate PO:{" "}
          {isAwarded && !hasPO
            ? "✓ ready"
            : hasPO
              ? "✓ done"
              : "— locked"}
        </span>
      </div>
    </section>
  );
}
