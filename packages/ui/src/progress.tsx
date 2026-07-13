/**
 * Progress — linear and radial progress indicators.
 *
 * V2: animated fill, intent thresholds, variants
 *   • variant: bar (default) | thin
 *   • intent: auto-computed from value thresholds or manual
 *   • animate: CSS progress-fill animation on mount
 */
import { cn } from "./cn";

export type ProgressIntent = "default" | "success" | "warning" | "danger";

const INTENT_FILL: Record<ProgressIntent, string> = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger:  "bg-danger",
};

const INTENT_TRACK: Record<ProgressIntent, string> = {
  default: "bg-primary-soft",
  success: "bg-success-soft-2",
  warning: "bg-warning-soft-2",
  danger:  "bg-danger-soft-2",
};

function autoIntent(value: number, max: number): ProgressIntent {
  const pct = (value / max) * 100;
  if (pct >= 95) return "danger";
  if (pct >= 80) return "warning";
  if (pct >= 60) return "default";
  return "success";
}

export function Progress({
  value,
  max = 100,
  intent,
  label,
  showValue = false,
  variant = "bar",
  animate = true,
  className,
}: {
  value: number;
  max?: number;
  /** Manual intent — if not provided, auto-computed from value/max ratio */
  intent?: ProgressIntent;
  label?: string;
  showValue?: boolean;
  variant?: "bar" | "thin";
  animate?: boolean;
  className?: string;
}) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const resolvedIntent = intent ?? autoIntent(value, max);

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && (
            <span className="text-xs text-foreground-muted">{label}</span>
          )}
          {showValue && (
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full",
          variant === "bar" ? "h-2" : "h-1",
          INTENT_TRACK[resolvedIntent]
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            "h-full rounded-full",
            INTENT_FILL[resolvedIntent],
            animate && "progress-fill"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
