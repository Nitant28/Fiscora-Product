/**
 * MetricCard — Premium KPI tile for Fiscora enterprise dashboards.
 *
 * V3 upgrades:
 *   • Top-right icon with intent-colored pill background
 *   • Larger, bolder value with tabular nums
 *   • Rich delta with arrow icon + comparison context
 *   • Mini sparkline area chart (optional)
 *   • Status badge, health dot, hint text
 *   • Bottom accent rail (intent color)
 *   • countUp animation on mount
 *   • Hover elevation lift
 */
import { type ReactNode } from "react";
import { cn } from "./cn";

export type MetricHealth = "healthy" | "warning" | "critical";
export type MetricIntent =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type DeltaDirection = "up" | "down" | "flat";

const INTENT_VALUE: Record<MetricIntent, string> = {
  default: "text-foreground",
  success: "text-success-fg",
  warning: "text-warning-fg",
  danger:  "text-danger-fg",
  info:    "text-info-fg",
};

const INTENT_ACCENT: Record<MetricIntent, string> = {
  default: "bg-transparent",
  success: "bg-success",
  warning: "bg-warning",
  danger:  "bg-danger",
  info:    "bg-info",
};

const INTENT_ICON_BG: Record<MetricIntent, string> = {
  default: "bg-muted-soft text-muted",
  success: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  danger:  "bg-danger-soft text-danger-fg",
  info:    "bg-info-soft text-info-fg",
};

const HEALTH_DOT: Record<MetricHealth, string> = {
  healthy:  "bg-success",
  warning:  "bg-warning",
  critical: "bg-danger",
};

const HEALTH_LABEL: Record<MetricHealth, string> = {
  healthy:  "Healthy",
  warning:  "Warning",
  critical: "Critical",
};

const DELTA_COLORS: Record<DeltaDirection, string> = {
  up:   "text-success-fg",
  down: "text-danger-fg",
  flat: "text-foreground-muted",
};

const DELTA_ICONS: Record<DeltaDirection, string> = {
  up:   "▲",
  down: "▼",
  flat: "→",
};

/** Tiny SVG sparkline for metric cards */
function MiniSparkline({ data, intent }: { data: number[]; intent: MetricIntent }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const W = 72; const H = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePoints = pts.join(" ");
  const areaPoints = `0,${H} ${linePoints} ${W},${H}`;

  const strokeColors: Record<MetricIntent, string> = {
    default: "#6366f1",
    success: "#16a34a",
    warning: "#d97706",
    danger:  "#dc2626",
    info:    "#0284c7",
  };
  const fillColors: Record<MetricIntent, string> = {
    default: "rgba(99,102,241,0.12)",
    success: "rgba(22,163,74,0.10)",
    warning: "rgba(217,119,6,0.10)",
    danger:  "rgba(220,38,38,0.10)",
    info:    "rgba(2,132,199,0.10)",
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      style={{ width: "72px", height: "24px", overflow: "visible", display: "block" }}
    >
      <polygon points={areaPoints} fill={fillColors[intent]} />
      <polyline
        points={linePoints}
        fill="none"
        stroke={strokeColors[intent]}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  trend,
  trendDirection,
  delta,
  deltaDirection,
  comparison,
  status,
  statusIntent,
  intent = "default",
  health,
  icon,
  sparkline,
  muted = false,
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  /** Small line beneath value e.g. "of total paid spend" */
  hint?: string;
  /** @deprecated use delta + deltaDirection instead */
  trend?: string;
  /** @deprecated use deltaDirection */
  trendDirection?: DeltaDirection;
  /** Delta value e.g. "18%" — shown as "▲ 18%" */
  delta?: string;
  /** Direction of the delta — determines color and icon */
  deltaDirection?: DeltaDirection;
  /** Context for delta e.g. "vs previous month" */
  comparison?: string;
  /** Status label e.g. "Within budget" */
  status?: string;
  /** Intent for the status badge */
  statusIntent?: MetricIntent;
  intent?: MetricIntent;
  health?: MetricHealth;
  icon?: ReactNode;
  /** Mini sparkline data (array of numbers) */
  sparkline?: number[];
  /** Renders value in quieter "no data" muted style */
  muted?: boolean;
  /** Makes the card a clickable link */
  href?: string;
  className?: string;
}) {
  // Support legacy trend/trendDirection props
  const resolvedDelta = delta ?? trend;
  const resolvedDeltaDir = deltaDirection ?? trendDirection;

  const content = (
    <div
      className={cn(
        "relative overflow-hidden bg-surface border border-border",
        "transition-[box-shadow,transform] duration-150 ease-out",
        href && "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover",
        "p-5",
        className
      )}
      style={{ borderRadius: "14px", boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.03)" }}
    >
      {/* Bottom accent rail — intent indicator */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-[3px]",
          INTENT_ACCENT[intent]
        )}
      />

      {/* Header: label + optional icon */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="kpi-label">{label}</p>
        {icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4",
              INTENT_ICON_BG[intent]
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {/* KPI Value */}
      <p
        className={cn(
          "kpi-value animate-countUp",
          muted
            ? "text-base font-medium text-muted"
            : INTENT_VALUE[intent]
        )}
      >
        {value}
      </p>

      {/* Delta + Comparison */}
      {(resolvedDelta || resolvedDeltaDir) && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {resolvedDelta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold",
                resolvedDeltaDir
                  ? DELTA_COLORS[resolvedDeltaDir]
                  : "text-foreground-muted"
              )}
            >
              {resolvedDeltaDir && (
                <span aria-hidden className="text-[10px]">
                  {DELTA_ICONS[resolvedDeltaDir]}{" "}
                </span>
              )}
              {resolvedDelta}
            </span>
          )}
          {comparison && (
            <span className="text-xs text-muted">{comparison}</span>
          )}
        </div>
      )}

      {/* Status badge */}
      {status && (
        <div className="mt-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
              statusIntent === "success"
                ? "bg-success-soft text-success-fg ring-green-200/60"
                : statusIntent === "danger"
                ? "bg-danger-soft text-danger-fg ring-red-200/60"
                : statusIntent === "warning"
                ? "bg-warning-soft text-warning-fg ring-amber-200/60"
                : "bg-muted-soft text-muted-fg ring-slate-200/60"
            )}
          >
            {status}
          </span>
        </div>
      )}

      {/* Health indicator */}
      {health && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              HEALTH_DOT[health]
            )}
          />
          <span className="text-xs text-muted">{HEALTH_LABEL[health]}</span>
        </div>
      )}

      {/* Hint */}
      {hint && !resolvedDelta && !health && (
        <p className="mt-2 text-xs text-muted">{hint}</p>
      )}
      {hint && (resolvedDelta || health) && (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      )}

      {/* Mini sparkline */}
      {sparkline && sparkline.length >= 2 && (
        <div className="mt-3">
          <MiniSparkline data={sparkline} intent={intent} />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block focus-ring" style={{ borderRadius: "14px" }}>
        {content}
      </a>
    );
  }

  return content;
}
