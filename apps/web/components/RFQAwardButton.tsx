"use client";

/**
 * RFQAwardButton
 * Purpose: Award an RFQ to the selected winning vendor bid.
 * Data: POST /api/proxy/rfqs/:id/award.
 * Roles: rfq.award.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RFQAwardButton({
  rfqId,
  vendorId,
  vendorName,
}: {
  rfqId: number;
  vendorId: number;
  vendorName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] =
    useState(false);

  async function handleAward() {
    if (
      !confirm(
        `Award RFQ to ${vendorName}?`
      )
    ) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `/api/proxy/rfqs/${rfqId}/award`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            vendorId,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ?? "Failed to award"
        );
      }

      router.refresh();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to award vendor"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleAward}
      disabled={loading}
      className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
    >
      {loading ? "..." : "Award"}
    </button>
  );
}
