"use client";

/**
 * GeneratePOButton
 * Purpose: Create a purchase order from an approved purchase request.
 * Data: POST purchase-requests/:id/generate-po (via proxy or API).
 * Roles: po.manage, request.approve.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GeneratePOButton({
  requestId,
  existingPoId,
}: {
  requestId: number;
  existingPoId?: number | null;
}) {
  const router = useRouter();
  const [loading, setLoading] =
    useState(false);

  if (existingPoId) {
    return (
      <a
        href={`/purchase-orders/${existingPoId}`}
        className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
      >
        View Purchase Order
      </a>
    );
  }

  async function handleGenerate() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/proxy/purchase-requests/${requestId}/generate-po`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            actor: "Manager",
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Failed to generate PO"
        );
      }

      router.push(
        `/purchase-orders/${data.purchaseOrder.id}`
      );
      router.refresh();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to generate PO"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {loading
        ? "Generating..."
        : "Generate Purchase Order"}
    </button>
  );
}
