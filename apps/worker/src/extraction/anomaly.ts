/**
 * Line-item price anomaly: flags rates far above historical average for same description.
 */
import prisma from "../../../api/src/db";

/* --- PRICE VS HISTORY --- */
export async function detectPriceAnomaly(
  description: string,
  rate: number
) {
  // Recent line items with matching description
  const previous =
    await prisma.lineItem.findMany({
      where: {
        description,
      },
      take: 20,
    });

  if (previous.length < 3) {
    return null;
  }

  const average =
    previous.reduce(
      (sum, item) =>
        sum + (item.rate || 0),
      0
    ) / previous.length;

  // 2× historical average → HIGH severity flag
  if (rate > average * 2) {
    return {
      type: "PRICE_ANOMALY",
      severity: "HIGH",
      message: `Price unusually high. Average ${average.toFixed(2)}`,
    };
  }

  return null;
}
