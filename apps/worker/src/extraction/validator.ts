/**
 * Financial validation (subtotal arithmetic) and vendor spend outlier detection.
 */
import { parseMoney } from "./money";
import { createFlag } from "./flags";

/* --- TYPES --- */
import { TypedFlag } from "./flags";
export type InvoiceFlag = TypedFlag;

/* --- SUBTOTAL / TOTAL MATH CHECK --- */
export function validateInvoice(
  data: {
    subtotal?: unknown;
    shipping?: unknown;
    tax?: unknown;
    discount?: unknown;
    totalAmount?: unknown;
    balanceDue?: unknown;
  },
  options?: {
    skipIfLowConfidence?: boolean;
  }
): InvoiceFlag[] {
  if (options?.skipIfLowConfidence) {
    return [];
  }

  const subtotal = parseMoney(
    data.subtotal
  );

  const shipping =
    parseMoney(data.shipping) ?? 0;

  const tax =
    parseMoney(data.tax) ?? 0;

  const discount =
    parseMoney(data.discount) ?? 0;

  const total =
    parseMoney(data.balanceDue) ??
    parseMoney(data.totalAmount);

  if (subtotal == null || total == null) {
    return [];
  }

  const expectedTotal =
    subtotal +
    shipping +
    tax -
    discount;

  const tolerance = 1;

  if (
    Math.abs(
      total - expectedTotal
    ) > tolerance
  ) {
    return [
      createFlag(
        "FINANCIAL_MISMATCH",
        "HIGH",
        `Expected $${expectedTotal.toFixed(2)} (subtotal + tax + shipping - discount) but extracted $${total.toFixed(2)}`
      ),
    ];
  }

  return [];
}

/* --- VENDOR SPEND OUTLIER --- */
export function detectUnusualAmount(
  invoiceAmount: number,
  vendorAverage: number,
  priorInvoiceCount: number
): InvoiceFlag | null {
  if (
    priorInvoiceCount < 2 ||
    vendorAverage <= 0
  ) {
    return null;
  }

  const threshold = 3;

  if (
    invoiceAmount >
    vendorAverage * threshold
  ) {
    return createFlag(
      "UNUSUAL_AMOUNT",
      "HIGH",
      `Invoice amount $${invoiceAmount.toLocaleString()} is ${(invoiceAmount / vendorAverage).toFixed(1)}x the vendor average of $${Math.round(vendorAverage).toLocaleString()}`
    );
  }

  return null;
}
