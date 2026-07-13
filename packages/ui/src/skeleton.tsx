/**
 * Skeleton loaders — enterprise shimmer loading states.
 *
 * Never show blank screens or endless spinners.
 * Every component uses skeleton loaders.
 *
 * Compositions:
 *   • Skeleton — base shimmer block
 *   • SkeletonText — text-line placeholders
 *   • SkeletonCard — card with title + content rows
 *   • SkeletonMetricCard — KPI tile placeholder
 *   • SkeletonTable — table with header + rows
 *   • SkeletonAvatar — circular avatar placeholder
 */
import { cn } from "./cn";

/* ── Base ─────────────────────────────────────────────────── */

export function Skeleton({
  className,
  width,
  height,
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={cn("rounded-md skeleton-shimmer", className)}
      style={{ width, height }}
      aria-hidden
    />
  );
}

/* ── Text Lines ───────────────────────────────────────────── */

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["w-full", "w-5/6", "w-4/6", "w-3/4", "w-2/3"];
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", widths[i % widths.length])}
        />
      ))}
    </div>
  );
}

/* ── Avatar ───────────────────────────────────────────────── */

export function SkeletonAvatar({
  size = "md",
  className,
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    xs: "h-5 w-5",
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
    xl: "h-12 w-12",
  };
  return (
    <div
      className={cn("rounded-full skeleton-shimmer", sizes[size], className)}
      aria-hidden
    />
  );
}

/* ── Metric Card ──────────────────────────────────────────── */

export function SkeletonMetricCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 shadow-card",
        className
      )}
      aria-hidden
    >
      {/* Label */}
      <Skeleton className="h-2.5 w-24" />
      {/* Value */}
      <Skeleton className="mt-4 h-8 w-32" />
      {/* Delta */}
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────── */

export function SkeletonCard({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 shadow-card",
        className
      )}
      aria-hidden
    >
      {/* Title */}
      <Skeleton className="h-4 w-36" />
      {/* Description */}
      <Skeleton className="mt-2 h-3 w-56" />
      {/* Content rows */}
      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Table ────────────────────────────────────────────────── */

export function SkeletonTable({
  rows = 6,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface shadow-card",
        className
      )}
      aria-hidden
    >
      {/* Header */}
      <div className="flex gap-4 border-b border-border bg-surface-subtle px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "h-2.5",
              i === 0 ? "w-28" : i === cols - 1 ? "w-16" : "w-20"
            )}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex gap-4 border-b border-border/50 px-4 py-3.5 last:border-0"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn(
                "h-3",
                c === 0 ? "w-32" : c === cols - 1 ? "w-20" : "w-24"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
