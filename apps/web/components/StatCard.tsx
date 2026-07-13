/**
 * StatCard
 * Purpose: Labeled metric card for invoice and entity detail pages.
 * Data: Props only (presentational).
 * Roles: N/A.
 */
import {
  NO_DATA,
  formatMoney,
  formatPercent,
  formatScore,
  formatText,
  formatCount,
  hasMoney,
  hasScore,
  isValidNumber,
} from "../lib/metrics";

type StatCardProps = {
  label: string;
  value: string | number | null | undefined;
  source?: string;
  variant?: "default" | "highlight";
  format?: "money" | "score" | "percent" | "count" | "text";
  emptyLabel?: string;
};

function formatValue(
  value: string | number | null | undefined,
  format: StatCardProps["format"],
  emptyLabel: string
): string {
  if (typeof value === "string") {
    return value.trim().length > 0
      ? value
      : emptyLabel;
  }

  switch (format) {
    case "money":
      if (!isValidNumber(value)) {
        return emptyLabel;
      }
      return formatMoney(value);
    case "score":
      return formatScore(value);
    case "percent":
      return formatPercent(value);
    case "count":
      return formatCount(value);
    case "text":
    default:
      return isValidNumber(value)
        ? String(value)
        : formatText(
            value as string | null,
            emptyLabel
          );
  }
}

export default function StatCard({
  label,
  value,
  source,
  variant = "default",
  format = "text",
  emptyLabel = "—",
}: StatCardProps) {
  const display = formatValue(
    value,
    format,
    emptyLabel
  );

  const isEmpty =
    display === emptyLabel;

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        variant === "highlight" && !isEmpty
          ? "border-blue-200 bg-blue-50"
          : "bg-white"
      }`}
    >
      <p className="text-sm text-gray-500">
        {label}
      </p>

      <p
        className={`mt-1 text-xl font-semibold ${
          isEmpty
            ? "text-sm font-normal text-gray-400"
            : ""
        }`}
      >
        {display}
      </p>

      {source && !isEmpty && (
        <p className="mt-1 text-xs text-gray-400">
          {source}
        </p>
      )}
    </div>
  );
}

export {
  NO_DATA,
  formatMoney,
  formatScore,
  formatPercent,
  formatText,
  formatCount,
  hasMoney,
  hasScore,
};
