/**
 * Deterministic date/number formatting for SSR-safe client components.
 * Always pass an explicit locale + timezone so server HTML matches hydration.
 */

const DATE_TIME_OPTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
};

export function formatDateTime(
  value: string | Date | null | undefined
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", DATE_TIME_OPTS);
}
