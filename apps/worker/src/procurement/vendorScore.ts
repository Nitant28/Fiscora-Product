import prisma from "../../../api/src/db";

export type VendorHealthScores = {
  reliabilityScore: number;
  deliveryScore: number;
  priceCompetitivenessScore: number;
  invoiceAccuracyScore: number;
  responseTimeScore: number;
};

export async function calculateVendorScores(
  vendorId: number,
  vendorName: string
): Promise<VendorHealthScores> {
  const documents =
    await prisma.document.findMany({
      where: { vendorName },
      include: {
        flags: true,
        lineItems: true,
      },
    });

  const invoiceCount =
    documents.length;

  if (invoiceCount === 0) {
    return {
      reliabilityScore: 0,
      deliveryScore: 0,
      priceCompetitivenessScore: 0,
      invoiceAccuracyScore: 0,
      responseTimeScore: 0,
    };
  }

  const avgConfidence =
    documents.reduce(
      (sum, doc) =>
        sum +
        (doc.confidenceScore || 0),
      0
    ) / invoiceCount;

  const missingFieldCount =
    documents.filter(
      (doc) =>
        !doc.invoiceNumber ||
        !doc.totalAmount ||
        !doc.invoiceDate
    ).length;

  const invoiceAccuracyScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        avgConfidence -
          (missingFieldCount /
            invoiceCount) *
            20
      )
    )
  );

  const highRiskFlags =
    documents.reduce(
      (sum, doc) =>
        sum +
        doc.flags.filter(
          (flag) =>
            flag.severity === "HIGH"
        ).length,
      0
    );

  const duplicateFlags =
    documents.reduce(
      (sum, doc) =>
        sum +
        doc.flags.filter(
          (flag) =>
            flag.type ===
            "DUPLICATE_INVOICE"
        ).length,
      0
    );

  const reliabilityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        70 +
          Math.min(
            invoiceCount * 3,
            20
          ) -
          highRiskFlags * 8 -
          duplicateFlags * 15
      )
    )
  );

  const matchedCount =
    documents.filter(
      (d) => d.purchaseOrderId != null
    ).length;

  const deliveryScore = Math.round(
    (matchedCount / invoiceCount) * 100
  );

  const vendorLineItems =
    documents.flatMap(
      (doc) => doc.lineItems
    );

  let priceCompetitivenessScore = 50;

  if (vendorLineItems.length > 0) {
    const pricingDiffs: number[] =
      [];

    for (const item of vendorLineItems) {
      if (!item.rate || !item.category) {
        continue;
      }

      const marketItems =
        await prisma.lineItem.findMany({
          where: {
            category: item.category,
            rate: { not: null },
            NOT: {
              document: {
                vendorName,
              },
            },
          },
          take: 30,
        });

      const marketRates = marketItems
        .map((m) => m.rate)
        .filter(
          (rate): rate is number =>
            rate != null && rate > 0
        );

      if (marketRates.length < 2) {
        continue;
      }

      const marketAvg =
        marketRates.reduce(
          (sum, rate) => sum + rate,
          0
        ) / marketRates.length;

      const diff =
        ((marketAvg - item.rate) /
          marketAvg) *
        100;

      pricingDiffs.push(diff);
    }

    if (pricingDiffs.length > 0) {
      const avgDiff =
        pricingDiffs.reduce(
          (sum, diff) => sum + diff,
          0
        ) / pricingDiffs.length;

      priceCompetitivenessScore =
        Math.max(
          0,
          Math.min(
            100,
            Math.round(75 + avgDiff)
          )
        );
    }
  }

  const approvedCount =
    documents.filter((d) =>
      ["approved", "paid"].includes(
        d.status
      )
    ).length;

  const responseTimeScore = Math.round(
    (approvedCount / invoiceCount) * 100
  );

  return {
    reliabilityScore,
    deliveryScore,
    priceCompetitivenessScore,
    invoiceAccuracyScore,
    responseTimeScore,
  };
}
