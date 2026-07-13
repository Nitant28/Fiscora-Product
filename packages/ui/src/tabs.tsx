"use client";

/**
 * Tabs — keyboard-accessible tab navigation primitive.
 *
 * Styles: underline (default) | pill
 * Keyboard: Arrow Left/Right to navigate, Home/End
 *
 * Usage:
 *   <TabList>
 *     <Tab id="overview" active={tab === "overview"} onClick={() => setTab("overview")}>
 *       Overview
 *     </Tab>
 *   </TabList>
 *   <TabPanel id="overview" active={tab === "overview"}>...</TabPanel>
 */
import { type ReactNode, type KeyboardEvent } from "react";
import { cn } from "./cn";

export type TabStyle = "underline" | "pill";

export function TabList({
  children,
  style: tabStyle = "underline",
  className,
}: {
  children: ReactNode;
  style?: TabStyle;
  className?: string;
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tabs = (e.currentTarget as HTMLDivElement).querySelectorAll<HTMLButtonElement>(
      '[role="tab"]:not([disabled])'
    );
    const arr = Array.from(tabs);
    const idx = arr.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      arr[(idx + 1) % arr.length]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      arr[(idx - 1 + arr.length) % arr.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      arr[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      arr[arr.length - 1]?.focus();
    }
  }

  return (
    <div
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-center",
        tabStyle === "underline"
          ? "gap-0 border-b border-border"
          : "gap-1 rounded-xl bg-surface-inset p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Tab({
  children,
  id,
  active = false,
  disabled = false,
  style: tabStyle = "underline",
  count,
  onClick,
  className,
}: {
  children: ReactNode;
  id: string;
  active?: boolean;
  disabled?: boolean;
  style?: TabStyle;
  /** Optional count badge e.g. "12" */
  count?: number | string;
  onClick?: () => void;
  className?: string;
}) {
  if (tabStyle === "pill") {
    return (
      <button
        role="tab"
        id={`tab-${id}`}
        aria-selected={active}
        aria-controls={`panel-${id}`}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150",
          "focus-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
          active
            ? "bg-surface text-foreground shadow-xs"
            : "text-muted hover:text-foreground",
          className
        )}
      >
        {children}
        {count !== undefined && (
          <span
            className={cn(
              "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
              active
                ? "bg-muted-soft text-muted-fg"
                : "bg-surface-inset text-muted"
            )}
          >
            {count}
          </span>
        )}
      </button>
    );
  }

  // Underline style
  return (
    <button
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      aria-controls={`panel-${id}`}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-4 pb-3 pt-0 text-sm font-medium transition-colors duration-150",
        "focus-ring disabled:pointer-events-none disabled:opacity-50",
        "border-b-2 -mb-px",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted hover:text-foreground",
        className
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
            active
              ? "bg-primary-soft text-primary"
              : "bg-muted-soft text-muted-fg"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function TabPanel({
  children,
  id,
  active = false,
  className,
}: {
  children: ReactNode;
  id: string;
  active?: boolean;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={cn("animate-fadeIn", className)}
    >
      {children}
    </div>
  );
}
