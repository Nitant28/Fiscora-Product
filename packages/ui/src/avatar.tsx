/**
 * Avatar — user/entity avatar with initials fallback.
 *
 * V2 additions:
 *   • size: xs(20) | sm(24) | md(32) | lg(40) | xl(48) | 2xl(64)
 *   • status dot: online | away | offline | busy
 *   • AvatarGroup — stacked overlapping avatars with +N overflow
 */
import { type ReactNode } from "react";
import { cn } from "./cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type AvatarStatus = "online" | "away" | "offline" | "busy";

const SIZES: Record<AvatarSize, { container: string; text: string }> = {
  xs:  { container: "h-5 w-5",    text: "text-[8px]" },
  sm:  { container: "h-6 w-6",    text: "text-[9px]" },
  md:  { container: "h-8 w-8",    text: "text-[11px]" },
  lg:  { container: "h-10 w-10",  text: "text-[13px]" },
  xl:  { container: "h-12 w-12",  text: "text-[15px]" },
  "2xl": { container: "h-16 w-16", text: "text-[19px]" },
};

const STATUS_DOT: Record<AvatarSize, string> = {
  xs:  "h-1.5 w-1.5 ring-1",
  sm:  "h-1.5 w-1.5 ring-1",
  md:  "h-2 w-2 ring-1",
  lg:  "h-2.5 w-2.5 ring-[1.5px]",
  xl:  "h-3 w-3 ring-2",
  "2xl": "h-3.5 w-3.5 ring-2",
};

const STATUS_COLORS: Record<AvatarStatus, string> = {
  online:  "bg-success",
  away:    "bg-warning",
  offline: "bg-neutral-400",
  busy:    "bg-danger",
};

/** Generate a consistent color from a name string */
function nameToColor(name: string): string {
  const colors = [
    "bg-indigo-500",
    "bg-violet-500",
    "bg-blue-500",
    "bg-cyan-600",
    "bg-teal-600",
    "bg-emerald-600",
    "bg-amber-600",
    "bg-orange-600",
    "bg-rose-500",
    "bg-pink-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? "bg-indigo-500";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = "md",
  status,
  className,
}: {
  name?: string;
  src?: string | null;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
}) {
  const { container, text } = SIZES[size];
  const initials = name ? getInitials(name) : "?";
  const bgColor = name ? nameToColor(name) : "bg-neutral-400";

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-semibold text-white select-none overflow-hidden",
          container,
          !src && bgColor
        )}
        title={name}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name ?? "Avatar"}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className={cn("leading-none", text)}>{initials}</span>
        )}
      </div>
      {status && (
        <span
          aria-label={status}
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-white",
            STATUS_DOT[size],
            STATUS_COLORS[status]
          )}
        />
      )}
    </div>
  );
}

/* ── AvatarGroup ─────────────────────────────────────────── */

export function AvatarGroup({
  users,
  max = 4,
  size = "sm",
  className,
}: {
  users: { name?: string; src?: string | null }[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;
  const { container, text } = SIZES[size];

  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((u, i) => (
        <div
          key={i}
          className={cn(
            "-ml-2 first:ml-0 rounded-full ring-2 ring-white",
          )}
        >
          <Avatar name={u.name} src={u.src} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "-ml-2 flex items-center justify-center rounded-full bg-neutral-200 ring-2 ring-white font-semibold text-neutral-600",
            container,
            text
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
