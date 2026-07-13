/**
 * Divider — horizontal and vertical visual separators.
 *
 * Variants: solid (default) | dashed
 * Orientation: horizontal (default) | vertical
 * Optional centered label
 */
import { type ReactNode } from "react";
import { cn } from "./cn";

export function Divider({
  orientation = "horizontal",
  variant = "solid",
  label,
  className,
}: {
  orientation?: "horizontal" | "vertical";
  variant?: "solid" | "dashed";
  label?: ReactNode;
  className?: string;
}) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn(
          "self-stretch w-px bg-border",
          variant === "dashed" && "border-l border-dashed border-border bg-transparent",
          className
        )}
      />
    );
  }

  if (label) {
    return (
      <div
        role="separator"
        className={cn("flex items-center gap-3 my-4", className)}
      >
        <div
          className={cn(
            "h-px flex-1 bg-border",
            variant === "dashed" && "bg-transparent border-t border-dashed border-border"
          )}
        />
        <span className="text-xs font-medium text-muted shrink-0">
          {label}
        </span>
        <div
          className={cn(
            "h-px flex-1 bg-border",
            variant === "dashed" && "bg-transparent border-t border-dashed border-border"
          )}
        />
      </div>
    );
  }

  return (
    <hr
      role="separator"
      className={cn(
        "border-0 border-t my-4",
        variant === "solid" ? "border-border" : "border-dashed border-border",
        className
      )}
    />
  );
}
