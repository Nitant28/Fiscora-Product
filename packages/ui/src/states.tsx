/**
 * Status feedback primitives — the enterprise "something went wrong" patterns.
 *
 * Every page should render one consistent surface for:
 *   • ErrorState        — server error / failed fetch (with Retry)
 *   • PermissionDenied  — RBAC blocked (403)
 *
 * These share the visual language of EmptyState so the whole product feels
 * like it was designed by one team.
 */
import { type ReactNode } from "react";
import { cn } from "./cn";

function Shell({
  tone,
  icon,
  title,
  description,
  action,
  className,
}: {
  tone: "danger" | "warning" | "neutral";
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  const ring = {
    danger: "bg-danger-soft text-danger-fg ring-danger-border",
    warning: "bg-warning-soft text-warning-fg ring-warning-border",
    neutral: "bg-surface-subtle text-muted ring-border",
  }[tone];

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-8 py-16 text-center",
        className
      )}
    >
      <div
        className={cn(
          "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 [&>svg]:h-7 [&>svg]:w-7",
          ring
        )}
      >
        {icon}
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ── Error / failed request ───────────────────────────────── */

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this data. Please try again.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Shell
      tone="danger"
      title={title}
      description={description}
      action={action}
      className={className}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      }
    />
  );
}

/* ── Permission denied (403) ──────────────────────────────── */

export function PermissionDenied({
  title = "You don't have access",
  description = "You don't have permission to view this. Contact your administrator if you think this is a mistake.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Shell
      tone="warning"
      title={title}
      description={description}
      action={action}
      className={className}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      }
    />
  );
}
