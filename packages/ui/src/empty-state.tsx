/**
 * EmptyState — professional "nothing here yet" pattern.
 *
 * V2 additions:
 *   • compact variant — for inline table empty states
 *   • secondaryAction — e.g. "Import from CSV"
 *   • illustration — slot for SVG art
 *   • Enhanced visual hierarchy
 */
import { type ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
}: {
  /** Small icon (shown in a circle) */
  icon?: ReactNode;
  /** Full illustration (shown above title) */
  illustration?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  /** Compact variant for inline table use */
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-10 px-6 text-center",
          className
        )}
      >
        {icon && (
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-muted-soft text-muted [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </div>
        )}
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-1 max-w-xs text-xs text-muted">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-8 py-16 text-center",
        className
      )}
    >
      {illustration && (
        <div className="mb-6">{illustration}</div>
      )}
      {icon && !illustration && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-subtle text-muted ring-1 ring-border [&>svg]:h-7 [&>svg]:w-7">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-foreground">
        {title}
      </p>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
      {secondaryAction && (
        <div className="mt-2">{secondaryAction}</div>
      )}
    </div>
  );
}
