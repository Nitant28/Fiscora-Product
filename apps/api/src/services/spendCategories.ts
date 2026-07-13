/**
 * Domain: Spend taxonomy — master spend categories for purchase requests and reporting.
 * Main exports: seedSpendCategoriesIfEmpty, backfillRequestCategories, listSpendCategories, getSpendCategory, SPEND_CATEGORIES.
 * Called by: server.ts, purchase-request.service.ts, lib/seed.ts.
 */
import prisma from "../db";

/* --- SEED DATA --- */

const SPEND_CATEGORIES = [
  { name: "Software", code: "SOFTWARE" },
  { name: "Marketing", code: "MARKETING" },
  { name: "Travel", code: "TRAVEL" },
  {
    name: "Office Supplies",
    code: "OFFICE_SUPPLIES",
  },
  {
    name: "IT Equipment",
    code: "IT_EQUIPMENT",
  },
  { name: "Consulting", code: "CONSULTING" },
  { name: "Legal", code: "LEGAL" },
  { name: "HR", code: "HR" },
  { name: "Operations", code: "OPERATIONS" },
] as const;

export async function seedSpendCategoriesIfEmpty() {
  const count =
    await prisma.spendCategory.count();

  if (count > 0) {
    return;
  }

  await prisma.spendCategory.createMany({
    data: SPEND_CATEGORIES.map((c) => ({
      name: c.name,
      code: c.code,
    })),
  });
}

export async function backfillRequestCategories() {
  const defaultCat =
    await prisma.spendCategory.findFirst({
      where: { code: "OPERATIONS" },
    });

  if (!defaultCat) {
    return;
  }

  await prisma.purchaseRequest.updateMany({
    where: { categoryId: null },
    data: { categoryId: defaultCat.id },
  });

  const categories =
    await prisma.spendCategory.findMany();

  for (const cat of categories) {
    await prisma.purchaseRequest.updateMany({
      where: {
        category: {
          equals: cat.name,
          mode: "insensitive",
        },
        categoryId: null,
      },
      data: { categoryId: cat.id },
    });
  }
}

/* --- QUERIES --- */

export async function listSpendCategories() {
  return prisma.spendCategory.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export async function getSpendCategory(id: number) {
  return prisma.spendCategory.findUnique({
    where: { id },
  });
}

export { SPEND_CATEGORIES };
