/**
 * Domain: Procurement catalog — pre-approved items and one-click catalog-to-PO ordering.
 * Main exports: listCatalogItems, getCatalogItem, orderFromCatalog, createCatalogItem.
 * Called by: modules/catalog/catalog.routes.ts.
 */
import prisma from "../db";
import { recordAuditLog } from "../lib/audit";
import {
  checkBudgetAvailability,
  reserveAndCommitBudget,
} from "../services/budgetEngine";
import { generatePOFromRequest } from "../modules/purchase-orders/purchase-order.service";

async function getCatalogSpendCategory() {
  return (
    (await prisma.spendCategory.findFirst({
      where: { code: "IT_EQUIPMENT" },
    })) ??
    (await prisma.spendCategory.findFirst({
      where: { code: "OPERATIONS" },
    }))
  );
}

export async function listCatalogItems(
  departmentId?: number
) {
  return prisma.catalogItem.findMany({
    where: {
      active: true,
      ...(departmentId
        ? {
            OR: [
              { departmentId },
              { departmentId: null },
            ],
          }
        : {}),
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          preferredVendor: true,
          status: true,
        },
      },
      department: {
        select: { id: true, name: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getCatalogItem(id: number) {
  return prisma.catalogItem.findUnique({
    where: { id },
    include: {
      vendor: true,
      department: true,
    },
  });
}

/* --- ORDERING --- */

export async function orderFromCatalog(input: {
  catalogItemId: number;
  requester: string;
  requesterId?: number;
  departmentId?: number;
}) {
  const item = await getCatalogItem(
    input.catalogItemId
  );

  if (!item || !item.active) {
    throw new Error("Catalog item not found");
  }

  if (item.vendor.status !== "ACTIVE") {
    throw new Error("Vendor not active");
  }

  const departmentId =
    input.departmentId ?? item.departmentId;

  if (departmentId) {
    const budgetCheck =
      await checkBudgetAvailability(
        departmentId,
        item.price
      );

    if (!budgetCheck.allowed) {
      throw new Error(
        budgetCheck.message ?? "Budget exceeded"
      );
    }
  }

  const spendCategory =
    await getCatalogSpendCategory();

  const request =
    await prisma.purchaseRequest.create({
      data: {
        title: item.name,
        description: item.description,
        vendorName: item.vendor.name,
        category: spendCategory?.name ?? "Catalog",
        categoryId: spendCategory?.id ?? null,
        requester: input.requester,
        requesterId: input.requesterId,
        estimatedAmount: item.price,
        departmentId,
        catalogItemId: item.id,
        fromCatalog: true,
        status: "APPROVED",
        approvedBy: "Catalog (auto)",
        approvedAt: new Date(),
      },
      include: { department: true, catalogItem: true },
    });

  if (departmentId) {
    await reserveAndCommitBudget(
      departmentId,
      item.price,
      "Catalog System",
      request.id
    );
  }

  await recordAuditLog(
    "PurchaseRequest",
    request.id,
    "Catalog Order Auto-Approved",
    input.requester,
    {
      newValue: {
        catalogItem: item.name,
        amount: item.price,
      },
    }
  );

  const po = await generatePOFromRequest(
    request.id,
    "Catalog System"
  );

  await recordAuditLog(
    "PurchaseOrder",
    po.id,
    "Catalog PO Auto-Generated",
    "Catalog System",
    { newValue: { poNumber: po.poNumber } }
  );

  return { request, po };
}

/* --- ADMIN --- */

export async function createCatalogItem(input: {
  name: string;
  description?: string;
  vendorId: number;
  price: number;
  departmentId?: number;
  actor: string;
}) {
  const item = await prisma.catalogItem.create({
    data: {
      name: input.name,
      description: input.description,
      vendorId: input.vendorId,
      price: input.price,
      departmentId: input.departmentId,
    },
    include: { vendor: true },
  });

  await recordAuditLog(
    "CatalogItem",
    item.id,
    "Catalog Item Created",
    input.actor,
    { newValue: { name: item.name, price: item.price } }
  );

  return item;
}
