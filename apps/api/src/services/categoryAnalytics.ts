/**
 * Domain: Analytics — spend breakdown by invoice line-item category.
 * Main exports: calculateCategoryAnalytics (and CategoryAnalyticsResult types).
 * Called by: server.ts, executiveAnalytics.ts (re-export).
 */
import prisma from "../db";

export interface CategoryAnalyticsRow {
  category: string;
  spend: number;
  invoices: number;
  percent: number;
}

export interface CategoryAnalyticsResult {
  categories: CategoryAnalyticsRow[];
  totalSpend: number;
}

export async function calculateCategoryAnalytics(): Promise<CategoryAnalyticsResult> {
  const lineItems =
    await prisma.lineItem.findMany({
      where: {
        amount: { not: null },
      },
      select: {
        category: true,
        amount: true,
        documentId: true,
      },
    });

  const categoryMap = new Map<
    string,
    {
      spend: number;
      invoiceIds: Set<number>;
    }
  >();

  for (const item of lineItems) {
    const category =
      item.category || "Other";

    const entry =
      categoryMap.get(category) ?? {
        spend: 0,
        invoiceIds: new Set<number>(),
      };

    entry.spend += item.amount ?? 0;
    entry.invoiceIds.add(item.documentId);
    categoryMap.set(category, entry);
  }

  const totalSpend = [...categoryMap.values()].reduce(
    (sum, row) => sum + row.spend,
    0
  );

  const categories: CategoryAnalyticsRow[] =
    [...categoryMap.entries()]
      .map(([category, row]) => ({
        category,
        spend: row.spend,
        invoices: row.invoiceIds.size,
        percent:
          totalSpend > 0
            ? Math.round(
                (row.spend / totalSpend) *
                  100
              )
            : 0,
      }))
      .sort((a, b) => b.spend - a.spend);

  return { categories, totalSpend };
}
