/**
 * AuditMetricCard
 * Purpose: Executive KPI tile for Audit Center summary widgets.
 */
type AuditMetricCardProps = {
  label: string;
  value: number | string;
  subtitle?: string;
  variant?: "default" | "amber" | "red" | "indigo";
};

export default function AuditMetricCard({
  label,
  value,
  subtitle,
  variant = "default",
}: AuditMetricCardProps) {
  const variantClass =
    variant === "amber"
      ? "border-amber-200 bg-amber-50"
      : variant === "red"
        ? "border-red-200 bg-red-50"
        : variant === "indigo"
          ? "border-indigo-200 bg-indigo-50"
          : "border-gray-200 bg-white";

  const labelClass =
    variant === "amber"
      ? "text-amber-800"
      : variant === "red"
        ? "text-red-800"
        : variant === "indigo"
          ? "text-indigo-800"
          : "text-gray-500";

  const valueClass =
    variant === "amber"
      ? "text-amber-900"
      : variant === "red"
        ? "text-red-900"
        : variant === "indigo"
          ? "text-indigo-900"
          : "text-gray-900";

  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm ${variantClass}`}
    >
      <p className={`text-sm font-medium ${labelClass}`}>
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-bold ${valueClass}`}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-600">
          {subtitle}
        </p>
      )}
    </div>
  );
}
