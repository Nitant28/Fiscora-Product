import prisma from "../../../api/src/db";
import {
  getItemBenchmark,
} from "./benchmark";

export type SavingsResult = {
  flag: {
    type: string;
    severity: string;
    message: string;
  };
  insight: {
    type: string;
    title: string;
    description: string;
    savingsAmount: number;
  };
};

export async function detectSavingsOpportunity(
  itemDescription: string,
  currentRate: number,
  category?: string | null,
  excludeDocumentId?: number
): Promise<SavingsResult | null> {
  const benchmark =
    await getItemBenchmark(
      itemDescription,
      category,
      excludeDocumentId
    );

  if (!benchmark) {
    return null;
  }

  if (
    currentRate <=
    benchmark.lowestRate * 1.2
  ) {
    return null;
  }

  const savings =
    currentRate -
    benchmark.lowestRate;

  const savingsRate =
    (savings / currentRate) * 100;

  return {
    flag: {
      type: "SAVINGS_OPPORTUNITY",
      severity: "MEDIUM",
      message: `Potential savings of $${savings.toFixed(2)} (${savingsRate.toFixed(1)}%) on ${itemDescription}. Best historical price: $${benchmark.lowestRate.toFixed(2)}`,
    },
    insight: {
      type: "SAVINGS_OPPORTUNITY",
      title: `Save on ${itemDescription}`,
      description: `Current vendor rate $${currentRate.toFixed(2)} vs market best $${benchmark.lowestRate.toFixed(2)}. Average market price: $${benchmark.averageRate.toFixed(2)}.`,
      savingsAmount: savings,
    },
  };
}

export async function getTotalPotentialSavings(): Promise<number> {
  // Query savings flags from InvoiceFlag table (procurementInsight model does not exist)
  const savingsFlags =
    await prisma.invoiceFlag.findMany({
      where: {
        type: "SAVINGS_OPPORTUNITY",
      },
      select: {
        message: true,
      },
    });

  // Extract dollar amounts from flag messages (e.g. "Potential savings of $12.50 ...")
  return savingsFlags.reduce(
    (sum: number, flag: { message: string }) => {
      const match = flag.message.match(
        /\$([0-9,.]+)/
      );
      return (
        sum +
        (match
          ? parseFloat(
              match[1].replace(/,/g, "")
            )
          : 0)
      );
    },
    0
  );
}
