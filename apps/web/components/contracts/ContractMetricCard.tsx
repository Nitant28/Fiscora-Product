type Props = {
  label: string;
  value?: number;
  displayText?: string;
  subtitle?: string;
  variant?: "default" | "amber" | "red";
};

export default function ContractMetricCard({
  label,
  value,
  displayText,
  subtitle,
  variant = "default",
}: Props) {
  const variantClass =
    variant === "red"
      ? "border-red-200 bg-red-50"
      : variant === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-indigo-200 bg-indigo-50";

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${variantClass}`}
    >
      <p className="text-sm font-medium text-gray-600">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold">
        {displayText ?? value ?? 0}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}
