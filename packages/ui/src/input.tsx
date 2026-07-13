"use client";

/**
 * Input — unified form input primitive for the Fiscora Design System.
 *
 * Features:
 *   • Leading icon slot
 *   • Trailing icon/action slot
 *   • Error state with message
 *   • Helper text
 *   • Size variants: sm | md | lg
 *   • Textarea variant
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export type InputSize = "sm" | "md" | "lg";

const INPUT_SIZES: Record<InputSize, string> = {
  sm: "h-8 text-xs px-3",
  md: "h-9 text-sm px-3.5",
  lg: "h-11 text-sm px-4",
};

const BASE_INPUT =
  "w-full rounded-lg border bg-surface text-foreground placeholder:text-muted " +
  "outline-none transition-[border-color,box-shadow] duration-150 " +
  "focus:border-primary focus:ring-2 focus:ring-primary/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "read-only:bg-surface-subtle read-only:cursor-default";

const ERROR_INPUT =
  "border-danger focus:border-danger focus:ring-danger/20";

const DEFAULT_BORDER =
  "border-border-strong hover:border-border-strong";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  size?: InputSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  trailingAction?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      hint,
      error,
      size = "md",
      leadingIcon,
      trailingIcon,
      trailingAction,
      className,
      id,
      ...props
    },
    ref
  ) {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const hasError = Boolean(error);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-xs font-semibold text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leadingIcon && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted [&>svg]:h-4 [&>svg]:w-4"
            >
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={cn(
              BASE_INPUT,
              INPUT_SIZES[size],
              hasError ? ERROR_INPUT : DEFAULT_BORDER,
              leadingIcon ? "pl-9" : undefined,
              (trailingIcon || trailingAction) ? "pr-9" : undefined,
              className
            )}
            {...props}
          />
          {(trailingIcon || trailingAction) && (
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted [&>svg]:h-4 [&>svg]:w-4">
              {trailingIcon ?? trailingAction}
            </span>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="mt-1.5 text-xs font-medium text-danger-fg"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className="mt-1.5 text-xs text-muted"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

/* ── Textarea ─────────────────────────────────────────────── */

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  resize?: "none" | "vertical" | "both";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, error, resize = "vertical", className, id, ...props }, ref) {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const hasError = Boolean(error);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold text-foreground">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={hasError}
          className={cn(
            BASE_INPUT,
            "px-3.5 py-2.5 text-sm",
            hasError ? ERROR_INPUT : DEFAULT_BORDER,
            resize === "none" && "resize-none",
            resize === "vertical" && "resize-y",
            resize === "both" && "resize",
            className
          )}
          {...props}
        />
        {error && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-danger-fg">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-muted">{hint}</p>
        )}
      </div>
    );
  }
);
