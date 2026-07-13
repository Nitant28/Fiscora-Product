/**
 * PageContainer — the single, canonical content container for every page.
 *
 * Enforces the Fiscora layout law so no page invents its own width/padding:
 *   • Horizontal padding: 16px (mobile) → 24px (tablet) → 32px (desktop)
 *   • Vertical padding:   24px (mobile) → 32px (desktop)
 *   • Max width by intent:  narrow (forms/detail) · default (lists/most pages)
 *                           wide (dense dashboards) · full (edge-to-edge)
 *
 * Renders a <div> (never <main>) — the app shell owns the single <main>
 * landmark, so pages must not nest another one.
 *
 * Vertical rhythm inside the page is opt-in via `rhythm` (8pt grid: 24px),
 * or pass your own spacing through `className`.
 */
import { type ReactNode } from "react";
import { cn } from "./cn";

export type PageWidth = "narrow" | "default" | "wide" | "full";

const MAX_WIDTH: Record<PageWidth, string> = {
  narrow: "max-w-3xl",
  default: "max-w-7xl",
  wide: "max-w-[96rem]",
  full: "max-w-none",
};

export function PageContainer({
  children,
  width = "default",
  /** Apply 24px vertical rhythm between direct children (8pt grid). */
  rhythm = false,
  className,
}: {
  children: ReactNode;
  width?: PageWidth;
  rhythm?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
        MAX_WIDTH[width],
        rhythm && "space-y-6",
        className
      )}
    >
      {children}
    </div>
  );
}
