export const PAYMENT_TERM_OPTIONS = [
  { days: 15, label: "Net 15" },
  { days: 30, label: "Net 30" },
  { days: 45, label: "Net 45" },
  { days: 60, label: "Net 60" },
  { days: 90, label: "Net 90" },
] as const;

export function formatPaymentTermsLabel(
  days: number
): string {
  return `Net ${days}`;
}

export function formatDueDate(
  value: string | Date | null | undefined
): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}
