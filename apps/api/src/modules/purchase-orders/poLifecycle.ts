import type { PurchaseOrderStatus } from "@prisma/client";

export const PO_TRANSITIONS: Record<
  PurchaseOrderStatus,
  PurchaseOrderStatus[]
> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PARTIALLY_RECEIVED", "RECEIVED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "CLOSED"],
  RECEIVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export function assertPOTransition(
  current: PurchaseOrderStatus,
  next: PurchaseOrderStatus
) {
  const allowed = PO_TRANSITIONS[current] ?? [];

  if (!allowed.includes(next)) {
    throw new Error(
      `Invalid PO transition: ${current} → ${next}`
    );
  }
}

export const PO_AUDIT_ACTIONS: Record<
  PurchaseOrderStatus,
  string | null
> = {
  DRAFT: null,
  SENT: "PO_SENT",
  ACCEPTED: "PO_ACCEPTED",
  PARTIALLY_RECEIVED: "PO_PARTIALLY_RECEIVED",
  RECEIVED: "PO_RECEIVED",
  CLOSED: "PO_CLOSED",
  CANCELLED: "PO_CANCELLED",
};
