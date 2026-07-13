import prisma from "../db";
import {
  getItemBenchmark,
} from "./benchmark";

export type ItemIntelligence = {
  lineItemId: number;
  description: string;
  currentPrice: number | null;
  historicalAveragePrice: number | null;
  lowestPriceSeen: number | null;
  highestPriceSeen: number | null;
  vendorAveragePrice: number | null;
  priceVariance: number | null;
  potentialSavings: number | null;
  sampleCount: number;
  availability: boolean;
  source: string;
};

const MIN_SAMPLES = 3;

export async function computeItemIntelligence(
  lineItem: {
    id: number;
    description: string;
    rate?: number | null;
    category?: string | null;
    documentId: number;
  },
  vendorName?: string | null
): Promise<ItemIntelligence> {
  const currentPrice =
    lineItem.rate ?? null;

  const benchmark =
    await getItemBenchmark(
      lineItem.description,
      lineItem.category,
      lineItem.documentId
    );

  let vendorRates: number[] = [];

  if (vendorName && currentPrice) {
    const vendorItems =
      await prisma.lineItem.findMany({
        where: {
          rate: { not: null },
          NOT: {
            documentId:
              lineItem.documentId,
          },
          document: {
            vendorName,
          },
        },
        take: 50,
      });

    vendorRates = vendorItems
      .map((item) => item.rate)
      .filter(
        (rate): rate is number =>
          rate != null && rate > 0
      );
  }

  const vendorAveragePrice =
    vendorRates.length >= 2
      ? vendorRates.reduce(
          (sum, rate) =>
            sum + rate,
          0
        ) / vendorRates.length
      : null;

  if (
    !benchmark ||
    benchmark.sampleCount < MIN_SAMPLES ||
    currentPrice == null
  ) {
    return {
      lineItemId: lineItem.id,
      description:
        lineItem.description,
      currentPrice,
      historicalAveragePrice: null,
      lowestPriceSeen: null,
      highestPriceSeen: null,
      vendorAveragePrice,
      priceVariance: null,
      potentialSavings: null,
      sampleCount:
        benchmark?.sampleCount ?? 0,
      availability: false,
      source:
        "LineItem table — requires ≥3 comparable historical rates",
    };
  }

  const allRates =
    await prisma.lineItem.findMany({
      where: {
        rate: { not: null },
        NOT: {
          documentId:
            lineItem.documentId,
        },
        OR: benchmark.comparableDescription
          ? [
              {
                description: {
                  contains:
                    benchmark.comparableDescription.split(
                      " "
                    )[0],
                  mode: "insensitive",
                },
              },
            ]
          : lineItem.category
            ? [
                {
                  category:
                    lineItem.category,
                },
              ]
            : [],
      },
      select: { rate: true },
      take: 100,
    });

  const rates = allRates
    .map((item) => item.rate)
    .filter(
      (rate): rate is number =>
        rate != null && rate > 0
    );

  const historicalAveragePrice =
    benchmark.averageRate;

  const lowestPriceSeen =
    rates.length > 0
      ? Math.min(...rates)
      : benchmark.lowestRate;

  const highestPriceSeen =
    rates.length > 0
      ? Math.max(...rates)
      : null;

  const priceVariance =
    historicalAveragePrice > 0
      ? Number(
          (
            ((currentPrice -
              historicalAveragePrice) /
              historicalAveragePrice) *
            100
          ).toFixed(1)
        )
      : null;

  const potentialSavings =
    currentPrice > lowestPriceSeen
      ? Number(
          (
            currentPrice -
            lowestPriceSeen
          ).toFixed(2)
        )
      : null;

  return {
    lineItemId: lineItem.id,
    description: lineItem.description,
    currentPrice,
    historicalAveragePrice,
    lowestPriceSeen,
    highestPriceSeen,
    vendorAveragePrice,
    priceVariance,
    potentialSavings,
    sampleCount: benchmark.sampleCount,
    availability: true,
    source:
      "Historical LineItem.rate for matching description/category",
  };
}

export async function computeDocumentItemIntelligence(
  documentId: number,
  vendorName?: string | null
): Promise<ItemIntelligence[]> {
  const lineItems =
    await prisma.lineItem.findMany({
      where: { documentId },
    });

  const results: ItemIntelligence[] =
    [];

  for (const item of lineItems) {
    results.push(
      await computeItemIntelligence(
        item,
        vendorName
      )
    );
  }

  return results;
}
