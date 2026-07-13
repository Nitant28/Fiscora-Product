export type FraudFlag = {
  type: string;
  severity: string;
  message: string;
};

function isRoundAmount(
  amount: number
): boolean {
  if (amount < 1000) {
    return false;
  }

  return amount % 1000 === 0;
}

function isWeekendDate(
  dateStr: string | null | undefined
): boolean {
  if (!dateStr) {
    return false;
  }

  const parsed = new Date(dateStr);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const day = parsed.getDay();

  return day === 0 || day === 6;
}

export function detectRoundAmountRisk(
  amount: number | null
): FraudFlag | null {
  if (!amount || !isRoundAmount(amount)) {
    return null;
  }

  return {
    type: "ROUND_AMOUNT_RISK",
    severity: "MEDIUM",
    message: `Round amount $${amount.toLocaleString()} may warrant additional review`,
  };
}

export function detectUnusualInvoiceDate(
  invoiceDate: string | null | undefined
): FraudFlag | null {
  if (!isWeekendDate(invoiceDate)) {
    return null;
  }

  return {
    type: "UNUSUAL_INVOICE_DATE",
    severity: "LOW",
    message: `Invoice dated on a weekend (${invoiceDate})`,
  };
}

export async function detectDuplicatePayment(
  vendorName: string | null | undefined,
  amount: number | null,
  documentId: number,
  prisma: {
    document: {
      findMany: (args: unknown) => Promise<
        Array<{
          id: number;
          invoiceNumber: string | null;
          createdAt: Date;
        }>
      >;
    };
  }
): Promise<FraudFlag | null> {
  if (!vendorName || !amount) {
    return null;
  }

  const recent =
    await prisma.document.findMany({
      where: {
        vendorName,
        totalAmount: amount,
        NOT: {
          id: documentId,
        },
        createdAt: {
          gte: new Date(
            Date.now() -
              30 * 24 * 60 * 60 * 1000
          ),
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true,
      },
      take: 5,
    });

  if (recent.length === 0) {
    return null;
  }

  const match = recent[0];

  return {
    type: "POSSIBLE_DUPLICATE_PAYMENT",
    severity: "HIGH",
    message: `Same vendor amount $${amount.toLocaleString()} seen on invoice #${match.invoiceNumber ?? match.id} within 30 days`,
  };
}

export function detectPossibleFraud(
  flags: FraudFlag[]
): FraudFlag | null {
  const hasDuplicate = flags.some(
    (flag) =>
      flag.type ===
      "POSSIBLE_DUPLICATE_PAYMENT"
  );

  const hasRound = flags.some(
    (flag) =>
      flag.type === "ROUND_AMOUNT_RISK"
  );

  if (hasDuplicate && hasRound) {
    return {
      type: "POSSIBLE_FRAUD",
      severity: "HIGH",
      message:
        "Multiple fraud indicators detected on this invoice",
    };
  }

  return null;
}
