"use client";

/**
 * Button — primary action primitive for the Fiscora Design System.
 *
 * Variants: primary | secondary | outline | ghost | danger | link
 * Sizes: xs | sm | md | lg
 * Extras: loading spinner, leading icon, trailing icon, fullWidth
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "link";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-fg shadow-xs hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "bg-muted-soft text-muted-fg hover:bg-slate-200 active:bg-slate-300",
  outline:
    "border border-border-strong bg-surface text-foreground shadow-xs hover:bg-surface-subtle active:bg-slate-100",
  ghost:
    "bg-transparent text-foreground hover:bg-muted-soft active:bg-slate-200",
  danger:
    "bg-danger text-white shadow-xs hover:bg-danger-hover active:bg-red-800",
  link:
    "bg-transparent text-primary underline-offset-2 hover:underline p-0 h-auto font-medium",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1",
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconTrailing?: ReactNode;
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonProps
>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    disabled,
    icon,
    iconTrailing,
    className,
    children,
    ...props
  },
  ref
) {
  const isLink = variant === "link";

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center rounded-lg font-medium",
        !isLink && "transition-[background-color,box-shadow,transform] duration-150 ease-out",
        !isLink && "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        !isLink && SIZES[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading ? (
        <span
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
          aria-hidden
        />
      ) : icon ? (
        <span aria-hidden className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      ) : null}
      {children}
      {iconTrailing && !loading && (
        <span aria-hidden className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
          {iconTrailing}
        </span>
      )}
    </button>
  );
});
