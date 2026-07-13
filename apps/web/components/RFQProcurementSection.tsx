"use client";

/**
 * RFQProcurementSection
 * Purpose: Procurement workspace for bids, vendors, and sourcing actions on RFQ detail.
 * Data: Client proxy calls to /rfqs/:id/* endpoints.
 * Roles: rfq.manage, rfq.view.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import RFQActions from "./RFQActions";
import type { UserWithPermissions } from "../lib/permissions";

export default function RFQProcurementSection({
  rfqId,
  status,
  recommendedVendorId,
  bidCount,
  hasScores,
  hasPO: initialHasPO,
  user,
}: {
  rfqId: number;
  status: string;
  recommendedVendorId?: number | null;
  bidCount: number;
  hasScores: boolean;
  hasPO: boolean;
  user: UserWithPermissions | null;
}) {
  const router = useRouter();
  const [generatingPO, setGeneratingPO] =
    useState(false);

  async function handleGeneratePO() {
    setGeneratingPO(true);
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
      router.refresh();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to generate PO"
      );
    } finally {
      setGeneratingPO(false);
    }
  }

  return (
    <RFQActions
      rfqId={rfqId}
      status={status}
      recommendedVendorId={
        recommendedVendorId
      }
      bidCount={bidCount}
      hasScores={hasScores}
      hasPO={initialHasPO}
      onGeneratePO={handleGeneratePO}
      generatingPO={generatingPO}
      user={user}
    />
  );
}
