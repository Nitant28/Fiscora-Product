"use client";

/**
 * ReceiveGoodsForm
 * Purpose: Record goods receipt quantities against a purchase order line.
 * Data: POST /api/proxy/purchase-orders/:id/receipts.
 * Roles: po.receive.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReceiveGoodsForm({
  poId,
  orderedQuantity,
  totalReceived,
  disabled,
}: {
  poId: number;
  orderedQuantity: number | null;
  totalReceived: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState<
    string | null
  >(null);

  const [quantityReceived, setQuantityReceived] =
    useState("");
  const [orderedQty, setOrderedQty] =
    useState(
      orderedQuantity?.toString() ?? ""
    );
  const [notes, setNotes] = useState("");

  const orderedTotal =
    orderedQuantity ??
    (Number(orderedQty) || 0);
  const remaining = orderedTotal - totalReceived;

  if (disabled) {
    return null;
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/proxy/purchase-orders/${poId}/receipts`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            quantityReceived: Number(
              quantityReceived
            ),
            orderedQuantity:
              orderedQuantity ??
              Number(orderedQty),
            notes: notes.trim() || undefined,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Failed to record receipt"
        );
      }

      setOpen(false);
      setQuantityReceived("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to record receipt"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            Goods Receipt (GRN)
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Ordered:{" "}
            {orderedQuantity ?? "—"} ·
            Received: {totalReceived}
            {orderedQuantity != null && (
              <>
                {" "}
                · Remaining: {remaining}
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Receive Goods
        </button>
      </div>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl border bg-gray-50 p-4"
        >
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {orderedQuantity == null && (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Order Quantity
              </label>
              <input
                type="number"
                required
                min="1"
                value={orderedQty}
                onChange={(e) =>
                  setOrderedQty(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border px-4 py-2"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Quantity Received
            </label>
            <input
              type="number"
              required
              min="1"
              max={
                remaining > 0
                  ? remaining
                  : undefined
              }
              value={quantityReceived}
              onChange={(e) =>
                setQuantityReceived(
                  e.target.value
                )
              }
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value)
              }
              rows={2}
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading
              ? "Submitting..."
              : "Submit Receipt"}
          </button>
        </form>
      )}
    </section>
  );
}
