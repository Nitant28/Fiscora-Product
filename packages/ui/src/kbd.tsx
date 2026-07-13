/**
 * Kbd — keyboard shortcut display primitive.
 * Used in the command palette footer and tooltip hints.
 */
import { type ReactNode } from "react";
import { cn } from "./cn";

export function Kbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded border border-border bg-surface-subtle",
        "px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted shadow-xs",
        "min-w-[18px]",
        className
      )}
    >
      {children}
    </kbd>
  );
}

/** A sequence of keyboard keys e.g. Ctrl+K */
export function KbdSequence({
  keys,
  className,
}: {
  keys: string[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key, i) => (
        <Kbd key={i}>{key}</Kbd>
      ))}
    </span>
  );
}
