"use client";

/**
 * InvoiceActions
 * Purpose: Approve, reject, or mark paid on an invoice document.
 * Data: POST /api/proxy/documents/:id/actions.
 * Roles: invoice.approve.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

const ACTIONS = [
  {
    id: "APPROVE",
    label: "Approve Invoice",
    status: "approved",
    className: "bg-green-600 hover:bg-green-700",
  },
  {
    id: "REJECT",
    label: "Reject Invoice",
    status: "rejected",
    className: "bg-red-600 hover:bg-red-700",
  },
  {
    id: "MARK_PAID",
    label: "Mark Paid",
    status: "paid",
    className: "bg-blue-600 hover:bg-blue-700",
  },
] as const;

export default function InvoiceActions({
  invoiceId,
  paymentBlocked = false,
  status,
}: {
  invoiceId: number;
  paymentBlocked?: boolean;
  status?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState<
    string | null
  >(null);

  const isBlocked =
    paymentBlocked || status === "blocked";

  async function submitAction(
    actionId: string,
    nextStatus: string
  ) {
    if (
      isBlocked &&
      (actionId === "APPROVE" ||
        actionId === "MARK_PAID")
    ) {
      setError(
        "This invoice is blocked for duplicate fraud risk."
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/proxy/documents/${invoiceId}/actions`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: actionId,
            status: nextStatus,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Failed to update invoice"
        );
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update invoice"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      {isBlocked && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Payment and approval are blocked
          until duplicate fraud risk is
          resolved.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {ACTIONS.map((action) => {
          const disabled =
            loading ||
            (isBlocked &&
              (action.id === "APPROVE" ||
                action.id === "MARK_PAID"));

          return (
            <button
              key={action.id}
              disabled={disabled}
              onClick={() =>
                submitAction(
                  action.id,
                  action.status
                )
              }
              className={`w-full rounded-lg px-4 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${action.className}`}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
