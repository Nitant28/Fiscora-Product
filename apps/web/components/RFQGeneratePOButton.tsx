"use client";

/**
 * RFQGeneratePOButton
 * Purpose: Generate purchase order after RFQ award.
 * Data: POST /api/proxy/rfqs/:id/generate-po.
 * Roles: po.manage, rfq.award.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RFQGeneratePOButton({
  rfqId,
  disabled,
  existingPoNumber,
  existingPoId,
}: {
  rfqId: number;
  disabled?: boolean;
  existingPoNumber?: string | null;
  existingPoId?: number | null;
}) {
  const router = useRouter();
  const [loading, setLoading] =
    useState(false);
  const [poNumber, setPoNumber] = useState<
    string | null
  >(existingPoNumber ?? null);
  const [poId, setPoId] = useState<
    number | null
  >(existingPoId ?? null);
  const [error, setError] = useState<
    string | null
  >(null);

  if (poNumber && poId) {
    return (
      <section className="mb-8 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-8 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-indigo-900">
          Purchase Order Generated
        </h2>
        <p className="text-3xl font-bold text-indigo-950">
          {poNumber}
        </p>
        <Link
          href={`/purchase-orders/${poId}`}
          className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          View Purchase Order →
        </Link>
      </section>
    );
  }

  if (disabled) {
    return null;
  }

  async function handleGenerate() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/proxy/rfqs/${rfqId}/generate-po`,
        { method: "POST" }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Failed to generate PO"
        );
      }

      setPoNumber(data.poNumber);
      setPoId(data.purchaseOrder?.id ?? null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate PO"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-8 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-indigo-900">
        Execute Award
      </h2>
      <p className="mb-4 text-indigo-800">
        Turn the sourcing decision into a
        purchase order.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading
          ? "Generating..."
          : "Generate PO"}
      </button>
    </section>
  );
}
