"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ContractActionContext =
  | "expiring"
  | "auto-renewal"
  | "underutilized"
  | "concentration";

type ActionDef = {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
};

const CONTRACT_ACTIONS: Record<
  ContractActionContext,
  ActionDef[]
> = {
  expiring: [
    { id: "renew", label: "Renew", variant: "primary" },
    { id: "create-rfq", label: "Create RFQ" },
    { id: "view-spend", label: "View Spend" },
  ],
  "auto-renewal": [
    {
      id: "disable-renewal",
      label: "Disable Renewal",
      variant: "danger",
    },
    { id: "escalate", label: "Escalate" },
    { id: "notify-owner", label: "Notify Owner" },
  ],
  underutilized: [
    { id: "review", label: "Review" },
    {
      id: "reduce-commitment",
      label: "Reduce Commitment",
    },
    {
      id: "terminate",
      label: "Terminate",
      variant: "danger",
    },
  ],
  concentration: [
    { id: "find-alternatives", label: "Find Alternatives" },
    { id: "create-rfq", label: "Create RFQ", variant: "primary" },
    { id: "vendor-benchmark", label: "Benchmark" },
  ],
};

const VARIANT_CLASS = {
  primary:
    "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700",
  secondary:
    "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
  danger:
    "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
};

export default function ContractActionButtons({
  context,
  contractId,
  vendorId,
  canManage,
}: {
  context: ContractActionContext;
  contractId?: number;
  vendorId?: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return null;
  }

  async function runAction(actionId: string) {
    setLoading(actionId);
    setError(null);
    setMessage(null);

    try {
      let url = "";

      if (context === "concentration") {
        if (!vendorId) {
          throw new Error("Vendor not available");
        }

        url = `/api/proxy/vendors/${vendorId}/contract-action/${actionId}`;
      } else {
        if (!contractId) {
          throw new Error("Contract not available");
        }

        url = `/api/proxy/contracts/${contractId}/${actionId}`;
      }

      const res = await fetch(url, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ?? "Action failed"
        );
      }

      setMessage(data.message ?? "Action completed");

      if (data.redirectUrl) {
        router.push(data.redirectUrl);
        router.refresh();
        return;
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

  const actions = CONTRACT_ACTIONS[context];

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => {
          if (
            action.id === "view-spend" &&
            contractId
          ) {
            return (
              <Link
                key={action.id}
                href={`/contracts/${contractId}`}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${VARIANT_CLASS.secondary}`}
              >
                {action.label}
              </Link>
            );
          }

          return (
            <button
              key={action.id}
              type="button"
              disabled={loading === action.id}
              onClick={() => runAction(action.id)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${VARIANT_CLASS[action.variant ?? "secondary"]}`}
            >
              {loading === action.id
                ? "..."
                : action.label}
            </button>
          );
        })}
      </div>
      {message && (
        <p className="text-xs text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
