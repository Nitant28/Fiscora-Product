/**
 * Domain: Vendor payment terms — Net-day options, due-date calculation, and terms resolution from vendor profile.
 * Main exports: DEFAULT_PAYMENT_TERMS_DAYS, PAYMENT_TERM_OPTIONS, formatPaymentTermsLabel, isValidPaymentTermsDays,
 *   calculateDueDate, resolvePaymentTermsDays.
 * Called by: paymentEngine.ts (re-export), vendorDirectory.ts, server.ts (vendor terms update).
 */

/* --- CONSTANTS --- */

export const DEFAULT_PAYMENT_TERMS_DAYS = 30;

export const PAYMENT_TERM_OPTIONS = [
  { days: 15, label: "Net 15" },
  { days: 30, label: "Net 30" },
  { days: 45, label: "Net 45" },
  { days: 60, label: "Net 60" },
  { days: 90, label: "Net 90" },
] as const;

export const ALLOWED_PAYMENT_TERMS_DAYS =
  PAYMENT_TERM_OPTIONS.map(
    (option) => option.days
  );

export function formatPaymentTermsLabel(
  days: number
): string {
  return `Net ${days}`;
}

export function isValidPaymentTermsDays(
  days: number
): boolean {
  return ALLOWED_PAYMENT_TERMS_DAYS.includes(
    days as (typeof ALLOWED_PAYMENT_TERMS_DAYS)[number]
  );
}

/* --- DUE DATE --- */

export function calculateDueDate(
  invoiceDate: Date,
  paymentTermsDays: number
): Date {
  const due = new Date(invoiceDate);
  due.setDate(
    due.getDate() + paymentTermsDays
  );
  return due;
}

export function resolvePaymentTermsDays(vendor: {
  paymentTermsDays?: number | null;
  paymentTerms?: string | null;
}): number {
  if (
    vendor.paymentTermsDays != null &&
    vendor.paymentTermsDays > 0
  ) {
    return vendor.paymentTermsDays;
  }

  if (vendor.paymentTerms) {
    const match =
      vendor.paymentTerms.match(/(\d+)/);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  return DEFAULT_PAYMENT_TERMS_DAYS;
}
