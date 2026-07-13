/**
 * DataTable primitives — enterprise-grade table shell for Fiscora.
 *
 * V2 additions:
 *   • density: compact | default | comfortable
 *   • stickyHeader — freezes header on scroll
 *   • zebra — alternating row tinting
 *   • loading — skeleton state with configurable row count
 *   • emptyState — slot for EmptyState component
 *   • TH sortDir — sort indicator (asc | desc | null)
 *   • TR selected — highlighted selected row
 */
import {
  type ReactNode,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
} from "react";
import { cn } from "./cn";

export type TableDensity = "compact" | "default" | "comfortable";

const DENSITY_TH: Record<TableDensity, string> = {
  compact:     "px-3 py-2",
  default:     "px-4 py-3",
  comfortable: "px-5 py-4",
};

const DENSITY_TD: Record<TableDensity, string> = {
  compact:     "px-3 py-2",
  default:     "px-4 py-3",
  comfortable: "px-5 py-4",
};

/* ── Container ────────────────────────────────────────────── */

export function DataTable({
  children,
  className,
  stickyHeader = false,
  maxHeight,
  loading = false,
  loadingRows = 5,
  emptyState,
}: {
  children: ReactNode;
  className?: string;
  stickyHeader?: boolean;
  maxHeight?: string;
  loading?: boolean;
  loadingRows?: number;
  emptyState?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-border bg-surface shadow-card",
        stickyHeader && "overflow-y-auto",
        className
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-sm">
        {loading ? (
          <tbody>
            {Array.from({ length: loadingRows }).map((_, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {[1, 2, 3, 4].map((j) => (
                  <td key={j} className="px-4 py-3">
                    <div
                      className={cn(
                        "h-4 rounded-md skeleton-shimmer",
                        j === 1 ? "w-32" : j === 2 ? "w-24" : j === 3 ? "w-20" : "w-16"
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ) : (
          children
        )}
      </table>
      {!loading && emptyState && (
        <div className="px-6 py-10">{emptyState}</div>
      )}
    </div>
  );
}

/* ── Head ─────────────────────────────────────────────────── */

export function THead({
  children,
  sticky = false,
}: {
  children: ReactNode;
  sticky?: boolean;
}) {
  return (
    <thead
      className={cn(
        "border-b border-border bg-surface-subtle",
        sticky && "sticky top-0 z-10"
      )}
    >
      {children}
    </thead>
  );
}

/* ── Body ─────────────────────────────────────────────────── */

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

/* ── Row ──────────────────────────────────────────────────── */

export function TR({
  children,
  className,
  hover = false,
  selected = false,
  zebra = false,
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  selected?: boolean;
  zebra?: boolean;
  index?: number;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0",
        hover && "transition-colors duration-100 hover:bg-surface-subtle",
        selected && "bg-primary-soft",
        zebra && index % 2 === 1 && "bg-surface-inset/40",
        className
      )}
    >
      {children}
    </tr>
  );
}

/* ── Header Cell ─────────────────────────────────────────── */

export function TH({
  children,
  className,
  numeric = false,
  density = "default",
  sortDir,
  onSort,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
  density?: TableDensity;
  sortDir?: "asc" | "desc" | null;
  onSort?: () => void;
}) {
  const sortable = onSort !== undefined;

  return (
    <th
      className={cn(
        "text-left text-[11px] font-bold uppercase tracking-[0.06em] text-muted",
        DENSITY_TH[density],
        numeric && "text-right",
        sortable && "cursor-pointer select-none hover:text-foreground-subtle transition-colors",
        className
      )}
      onClick={sortable ? onSort : undefined}
      aria-sort={
        sortDir === "asc"
          ? "ascending"
          : sortDir === "desc"
          ? "descending"
          : undefined
      }
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <span aria-hidden className="text-[10px]">
            {sortDir === "asc"
              ? "↑"
              : sortDir === "desc"
              ? "↓"
              : "↕"}
          </span>
        )}
      </span>
    </th>
  );
}

/* ── Data Cell ───────────────────────────────────────────── */

export function TD({
  children,
  className,
  numeric = false,
  density = "default",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
  density?: TableDensity;
}) {
  return (
    <td
      className={cn(
        "text-foreground-subtle",
        DENSITY_TD[density],
        numeric && "text-right font-tabular tabular-nums",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}
