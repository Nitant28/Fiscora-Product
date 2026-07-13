"use client";

/**
 * Tooltip — accessible hover/focus tooltip component.
 * Replaces native browser tooltips by intercepting the 'title' attribute.
 *
 * Side: top (default) | right | bottom | left
 */
import {
  useState,
  useRef,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";

export type TooltipSide = "top" | "right" | "bottom" | "left";

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content?: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // 120ms delay on fade-out / closing
    timerRef.current = setTimeout(() => {
      setOpen(false);
    }, 120);
  };

  let tooltipContent = content;
  let trigger = children;

  // Intercept children's title attribute if content is not provided
  if (isValidElement(children)) {
    const childProps = children.props as Record<string, any>;
    if (childProps.title && !content) {
      tooltipContent = childProps.title;
    }
    // Always strip title if we are displaying a custom tooltip to avoid double tooltips
    if (childProps.title) {
      const { title, ...rest } = childProps;
      // We pass hover and focus handlers to the cloned element to ensure the tooltip triggers correctly
      trigger = cloneElement(children, {
        ...rest,
        onMouseEnter: (e: any) => {
          childProps.onMouseEnter?.(e);
          handleMouseEnter();
        },
        onMouseLeave: (e: any) => {
          childProps.onMouseLeave?.(e);
          handleMouseLeave();
        },
        onFocus: (e: any) => {
          childProps.onFocus?.(e);
          handleMouseEnter();
        },
        onBlur: (e: any) => {
          childProps.onBlur?.(e);
          handleMouseLeave();
        },
      } as any);
    }
  }

  // If no content, just render the trigger
  if (!tooltipContent) {
    return <>{children}</>;
  }

  const sideClasses: Record<TooltipSide, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2 origin-top",
    left: "right-full top-1/2 -translate-y-1/2 mr-2 origin-right",
    right: "left-full top-1/2 -translate-y-1/2 ml-2 origin-left",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {trigger}
      {open && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 pointer-events-none",
            sideClasses[side]
          )}
        >
          <div
            className={cn(
              "tooltip-content rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-popover whitespace-nowrap",
              className
            )}
          >
            {tooltipContent}
          </div>
        </div>
      )}
    </div>
  );
}
