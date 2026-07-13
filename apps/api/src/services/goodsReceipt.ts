/**
 * Domain: Receiving — goods receipt records, PO quantity tracking, and receive-to-close lifecycle.
 * Main exports: getTotalReceivedQuantity, listGoodsReceipts, createGoodsReceipt.
 * Called by: purchase-order.controller.ts, threeWayMatch.ts.
 */
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";
import { notifyPoReceived } from "./notificationService";

export async function getTotalReceivedQuantity(
  purchaseOrderId: number
) {
  const result =
    await prisma.goodsReceipt.aggregate({
      where: { purchaseOrderId },
      _sum: { quantityReceived: true },
    });

  return result._sum.quantityReceived ?? 0;
}

export async function listGoodsReceipts(
  purchaseOrderId: number
) {
  return prisma.goodsReceipt.findMany({
    where: { purchaseOrderId },
    orderBy: { receivedDate: "desc" },
    include: {
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/* --- RECEIVING --- */

export async function createGoodsReceipt(input: {
  purchaseOrderId: number;
  quantityReceived: number;
  receivedById: number;
  notes?: string;
  orderedQuantity?: number;
}) {
  const po =
    await prisma.purchaseOrder.findUnique({
      where: { id: input.purchaseOrderId },
    });

  if (!po) {
    throw new Error("Purchase order not found");
  }

  if (
    !["ACCEPTED", "PARTIALLY_RECEIVED"].includes(
      po.status
    )
  ) {
    throw new Error(
      "PO must be ACCEPTED before receiving goods"
    );
  }

  let orderedQuantity =
    po.orderedQuantity ??
    input.orderedQuantity;

  if (
    orderedQuantity == null ||
    orderedQuantity <= 0
  ) {
    throw new Error(
      "Ordered quantity is required on the PO"
    );
  }

  if (input.quantityReceived <= 0) {
    throw new Error(
      "Quantity received must be greater than zero"
    );
  }

  const alreadyReceived =
    await getTotalReceivedQuantity(
      input.purchaseOrderId
    );

  const totalReceived =
    alreadyReceived + input.quantityReceived;

  if (totalReceived > orderedQuantity) {
    throw new Error(
      `Cannot receive ${input.quantityReceived} units — only ${orderedQuantity - alreadyReceived} remaining`
    );
  }

  const receipt =
    await prisma.$transaction(async (tx) => {
      if (
        po.orderedQuantity == null &&
        input.orderedQuantity
      ) {
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            orderedQuantity:
              input.orderedQuantity,
          },
        });
      }

      const created =
        await tx.goodsReceipt.create({
          data: {
            purchaseOrderId:
              input.purchaseOrderId,
            quantityOrdered: orderedQuantity,
            quantityReceived:
              input.quantityReceived,
            receivedById:
              input.receivedById,
            notes: input.notes?.trim(),
          },
          include: {
            receiver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

      const newStatus =
        totalReceived >= orderedQuantity
          ? "RECEIVED"
          : "PARTIALLY_RECEIVED";

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: newStatus,
          ...(newStatus === "RECEIVED"
            ? {
                receivedAt:
                  po.receivedAt ?? new Date(),
              }
            : {}),
        },
      });

      return created;
    });

  const receiver = receipt.receiver;

  await recordAuditLog(
    "GoodsReceipt",
    receipt.id,
    "GOODS_RECEIVED",
    receiver.name,
    {
      newValue: {
        poNumber: po.poNumber,
        quantityReceived:
          input.quantityReceived,
        totalReceived,
        quantityOrdered: orderedQuantity,
        purchaseOrderId: po.id,
      },
      metadata: {
        notes: input.notes ?? null,
      },
    }
  );

  void notifyPoReceived(
    {
      id: po.id,
      poNumber: po.poNumber,
      vendorName: po.vendorName,
      quantityReceived: input.quantityReceived,
    },
    receiver.name
  ).catch(console.error);

  return receipt;
}
