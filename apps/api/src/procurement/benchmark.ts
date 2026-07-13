import prisma from "../db";

export type ItemBenchmark = {
  lowestRate: number;
  averageRate: number;
  sampleCount: number;
  comparableDescription: string | null;
};

function extractCoreKeyword(
  description: string
): string | null {
  const text = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");

  const keywords = [
    "bookcase",
    "chair",
    "desk",
    "table",
    "laptop",
    "monitor",
    "printer",
    "phone",
    "paper",
    "cabinet",
    "shelf",
  ];

  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      return keyword;
    }
  }

  const tokens = text
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 5 &&
        !/^\d+$/.test(token)
    );

  return tokens[0] ?? null;
}

export async function getItemBenchmark(
  itemDescription: string,
  category?: string | null,
  excludeDocumentId?: number
): Promise<ItemBenchmark | null> {
  const keyword =
    extractCoreKeyword(
      itemDescription
    );

  const whereClause: {
    rate: { not: null };
    NOT?: { documentId: number };
    OR?: Array<{
      description?: {
        contains: string;
        mode: "insensitive";
      };
      category?: string;
    }>;
    category?: string;
  } = {
    rate: { not: null },
  };

  if (excludeDocumentId) {
    whereClause.NOT = {
      documentId:
        excludeDocumentId,
    };
  }

  if (keyword) {
    whereClause.OR = [
      {
        description: {
          contains: keyword,
          mode: "insensitive",
        },
      },
    ];

    if (category) {
      whereClause.OR.push({
        category,
      });
    }
  } else if (category) {
    whereClause.category = category;
  } else {
    return null;
  }

  const previous =
    await prisma.lineItem.findMany({
      where: whereClause,
      take: 50,
      orderBy: {
        createdAt: "desc",
      },
    });

  const rates = previous
    .map((item) => item.rate)
    .filter(
      (rate): rate is number =>
        rate != null && rate > 0
    );

  if (rates.length < 2) {
    return null;
  }

  const lowestRate = Math.min(
    ...rates
  );

  const averageRate =
    rates.reduce(
      (sum, rate) => sum + rate,
      0
    ) / rates.length;

  return {
    lowestRate,
    averageRate,
    sampleCount: rates.length,
    comparableDescription:
      previous[0]?.description ?? null,
  };
}
