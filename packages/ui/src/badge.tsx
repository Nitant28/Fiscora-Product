/**
 * Badge — Premium pill component for Fiscora enterprise UI.
 *
 * V3 upgrades:
 *   • Larger dot (5px), always enabled for enterprise look
 *   • Softer muted backgrounds matching the reference design
 *   • Tighter letter-spacing for professionalism
 *   • ring-1 ring-inset for subtle depth
 *   • New "outline" and "dot" variants
 *
 * Tones: neutral | primary | success | warning | danger | info
 * Sizes: sm | md (default) | lg
 */
import { type ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type BadgeVariant = "filled" | "outline" | "dot";
export type BadgeSize = "sm" | "md" | "lg";

const TONE_FILLED: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200/70",
  primary: "bg-indigo-50 text-indigo-700 ring-indigo-200/60",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  warning: "bg-amber-50 text-amber-700 ring-amber-200/60",
  danger:  "bg-rose-50 text-rose-700 ring-rose-200/60",
  info:    "bg-sky-50 text-sky-700 ring-sky-200/60",
};

const TONE_OUTLINE: Record<BadgeTone, string> = {
  neutral: "bg-transparent text-slate-500 ring-slate-300",
  primary: "bg-transparent text-indigo-600 ring-indigo-400",
  success: "bg-transparent text-emerald-600 ring-emerald-400",
  warning: "bg-transparent text-amber-600 ring-amber-400",
  danger:  "bg-transparent text-rose-600 ring-rose-400",
  info:    "bg-transparent text-sky-600 ring-sky-400",
};

const TONE_DOT: Record<BadgeTone, string> = {
  neutral: "bg-slate-400",
  primary: "bg-indigo-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger:  "bg-rose-500",
  info:    "bg-sky-500",
};

const SIZES: Record<BadgeSize, string> = {
  sm: "px-1.5 py-px text-[10px] gap-1",
  md: "px-2 py-0.5 text-[11px] gap-1.5",
  lg: "px-2.5 py-1 text-xs gap-1.5",
};

export function Badge({
  children,
  tone = "neutral",
  variant = "filled",
  size = "md",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Show a small colored dot before the label */
  dot?: boolean;
  className?: string;
}) {
  const toneClass =
    variant === "outline"
      ? TONE_OUTLINE[tone]
      : TONE_FILLED[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold ring-1 ring-inset tracking-tight",
        toneClass,
        SIZES[size],
        className
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "h-[5px] w-[5px] shrink-0 rounded-full",
            TONE_DOT[tone]
          )}
        />
      )}
      {children}
    </span>
  );
}
