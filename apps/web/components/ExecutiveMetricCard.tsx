/**
 * ExecutiveMetricCard
 * Purpose: Formatted KPI tile for executive and control-tower dashboards.
 * Data: Props from analytics API responses.
 * Roles: control.view, cashforecast.view.
 */
import {
  formatCount,
  formatINR,
  formatMoney,
  formatPercent,
} from "../lib/metrics";

type ExecutiveMetricCardProps = {
  label: string;
  value?: number;
  format?: "money" | "inr" | "count" | "percent" | "hours";
  displayText?: string;
  variant?: "default" | "green" | "amber" | "red";
  subtitle?: string;
};

function renderValue(
  value: number,
  format: NonNullable<
    ExecutiveMetricCardProps["format"]
  >
): string {
  switch (format) {
    case "money":
      return formatMoney(value);
    case "inr":
      return formatINR(value);
    case "count":
      return formatCount(value);
    case "percent":
      return formatPercent(value);
    case "hours":
      return `${value}h`;
  }
}

export default function ExecutiveMetricCard({
  label,
  value,
  format = "count",
  displayText,
  variant = "default",
  subtitle,
}: ExecutiveMetricCardProps) {
  const isMuted = displayText != null;

  const display =
    displayText ??
    renderValue(value ?? 0, format);

  const variantClass =
    variant === "green"
      ? "border-green-200 bg-green-50"
      : variant === "amber"
        ? "border-amber-200 bg-amber-50"
        : variant === "red"
          ? "border-red-200 bg-red-50"
          : "border-gray-200 bg-slate-50";

  const labelClass =
    variant === "green"
      ? "text-green-700"
      : variant === "amber"
        ? "text-amber-700"
        : variant === "red"
          ? "text-red-700"
          : "text-gray-500";

  const valueClass = isMuted
    ? "text-lg font-medium text-gray-500"
    : variant === "green"
      ? "text-green-700"
      : variant === "amber"
        ? "text-amber-700"
        : variant === "red"
          ? "text-red-700"
          : "text-gray-900";

  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm ${variantClass}`}
    >
      <h2 className={`text-sm ${labelClass}`}>
        {label}
      </h2>
      <p
        className={`mt-2 font-bold ${isMuted ? "" : "text-3xl"} ${valueClass}`}
      >
        {display}
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-600">
          {subtitle}
        </p>
      )}
    </div>
  );
}
