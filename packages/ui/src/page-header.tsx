/**
 * PageHeader — consistent page title, breadcrumb, tab bar, and action area.
 *
 * V2 additions:
 *   • badge — status indicator next to title
 *   • backHref — back-navigation link
 *   • tabs — inline tab navigation slot (use <Tabs> component)
 *   • Refined typography: tighter headings, smaller description
 */
import { type ReactNode } from "react";
import { cn } from "./cn";

export function PageHeader({
  title,
  description,
  breadcrumb,
  badge,
  backHref,
  actions,
  tabs,
  className,
}: {
  title: string;
  description?: string;
  breadcrumb?: ReactNode;
  /** Badge/pill next to the title e.g. status */
  badge?: ReactNode;
  /** Back navigation link (shows ← arrow) */
  backHref?: string;
  actions?: ReactNode;
  /** Tab navigation rendered below the title */
  tabs?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8", className)}>
      {/* Back navigation */}
      {backHref && (
        <a
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </a>
      )}

      {/* Breadcrumb */}
      {breadcrumb && (
        <div className="mb-2 text-xs font-medium text-muted">
          {breadcrumb}
        </div>
      )}

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {description && (
            <p className="mt-1 text-sm text-foreground-subtle leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Tab navigation */}
      {tabs && <div className="mt-5">{tabs}</div>}
    </div>
  );
}
