/**
 * Card & Section — premium surface containers for the Fiscora Design System.
 *
 * Card variants: default | outlined | elevated | flat
 * Card sizes: sm (p-4) | md (p-6, default) | lg (p-8)
 *
 * Section: logical grouping with title, description, optional divider, actions.
 */
import { type ReactNode } from "react";
import { cn } from "./cn";

export type CardVariant = "default" | "outlined" | "elevated" | "flat";
export type CardSize = "sm" | "md" | "lg";

const CARD_VARIANTS: Record<CardVariant, string> = {
  default:  "border border-border bg-surface",
  outlined: "border-2 border-border-strong bg-surface",
  elevated: "border border-border bg-surface",
  flat:     "bg-surface-subtle",
};

const CARD_SIZES: Record<CardSize, string> = {
  sm: "p-4",
  md: "p-5",
  lg: "p-7",
};

export function Card({
  children,
  className,
  variant = "default",
  size = "md",
  noPad = false,
  interactive = false,
  /** @deprecated use size prop instead */
  padded,
}: {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
  size?: CardSize;
  /** Remove all padding (for tables, images, etc.) */
  noPad?: boolean;
  /** Add hover-lift affordance for clickable cards */
  interactive?: boolean;
  /** @deprecated use noPad={true} */
  padded?: boolean;
}) {
  const shouldPad = padded !== false && !noPad;

  return (
    <div
      className={cn(
        "overflow-hidden",
        CARD_VARIANTS[variant],
        shouldPad && CARD_SIZES[size],
        interactive &&
          "cursor-pointer transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5",
        className
      )}
      style={{
        borderRadius: "14px",
        boxShadow: variant === "elevated"
          ? "0 4px 16px -2px rgba(15,23,42,0.10), 0 2px 6px -2px rgba(15,23,42,0.06)"
          : "0 1px 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.03)",
        ...(interactive ? { transition: "box-shadow 150ms ease, transform 150ms ease" } : {}),
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  border = false,
}: {
  title?: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
  border?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-6 py-4",
        border && "border-b border-border",
        className
      )}
    >
      <div className="min-w-0">
        {title && typeof title === "string" ? (
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
        ) : (
          title
        )}
        {description && (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="shrink-0 flex items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  tight = false,
  divider = false,
  href,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Reduce spacing between header and children */
  tight?: boolean;
  /** Show a subtle divider below the header */
  divider?: boolean;
  /** Optional "View all" link */
  href?: string;
}) {
  return (
    <section className={cn("space-y-4", tight && "space-y-3", className)}>
      {(title || actions || href) && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              {title && (
                <h2 style={{ fontSize: "13.5px", fontWeight: 600, letterSpacing: "-0.01em", color: "#0b1220", margin: 0 }}>
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-xs text-muted">{description}</p>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-3">
              {actions}
              {href && (
                <a href={href} style={{ fontSize: "11.5px", color: "#4f46e5", fontWeight: 500, textDecoration: "none" }}>
                  View all →
                </a>
              )}
            </div>
          </div>
          {divider && (
            <hr className="border-0 border-t border-border" />
          )}
        </>
      )}
      {children}
    </section>
  );
}

