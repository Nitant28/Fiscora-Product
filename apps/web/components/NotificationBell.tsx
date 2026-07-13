"use client";

/**
 * NotificationBell — universal notification center dropdown (Sprint 18C.1).
 * Top-right bell icon with unread badge, dropdown inbox, mark-read, and deep links.
 *
 * V2 upgrades:
 *   • Proper SVG severity icons instead of generic color dots.
 *   • Dropdown styled with shadow-popover and rounded-2xl.
 *   • Unread items use bg-primary-soft/30.
 *   • Animated badge count with a brief scale pulse on new notifications.
 *   • Client-side "Archive" action per notification (persisted in localStorage).
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@repo/ui/cn";

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  entityType: string | null;
  entityId: number | null;
  actionUrl: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function SeverityIcon({ severity }: { severity: "INFO" | "WARNING" | "CRITICAL" }) {
  switch (severity) {
    case "WARNING":
      return (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-fg ring-1 ring-warning-border">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </span>
      );
    case "CRITICAL":
      return (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger-fg ring-1 ring-danger-border">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
        </span>
      );
    case "INFO":
    default:
      return (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info-fg ring-1 ring-info-border">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.25v2.75a.75.75 0 001.5 0V10A.75.75 0 0010 9H9z" clipRule="evenodd" />
          </svg>
        </span>
      );
  }
}

export default function NotificationBell({
  initialUnreadCount = 0,
}: {
  initialUnreadCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [archivedIds, setArchivedIds] = useState<number[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(initialUnreadCount);

  // Load archived IDs from localStorage on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("fiscora.notifications.archived") ?? "[]"
      );
      setArchivedIds(stored);
    } catch {
      // ignore
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proxy/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Handle pulse animation on new notifications
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 300);
      prevCountRef.current = unreadCount;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
    }
    return () =>
      document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markRead(id: number) {
    await fetch(`/api/proxy/notifications/${id}/read`, {
      method: "PATCH",
    });
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
      )
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch("/api/proxy/notifications/read-all", {
      method: "PATCH",
    });
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        read: true,
        readAt: n.readAt ?? new Date().toISOString(),
      }))
    );
    setUnreadCount(0);
  }

  const archiveNotification = (id: number) => {
    const next = [...archivedIds, id];
    setArchivedIds(next);
    try {
      localStorage.setItem(
        "fiscora.notifications.archived",
        JSON.stringify(next)
      );
    } catch {
      // ignore
    }
    const notif = notifications.find((n) => n.id === id);
    if (notif && !notif.read) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const visibleNotifications = notifications.filter(
    (n) => !archivedIds.includes(n.id)
  );

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-foreground-subtle hover:bg-surface-inset transition-colors"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white",
              pulse && "animate-[badgePulse_300ms_ease-in-out]"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notification-panel absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-2xl border border-border bg-surface shadow-popover animate-slideDown"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-semibold text-foreground">
                Notifications
              </p>
              {unreadCount > 0 && (
                <p className="text-xs text-muted">
                  {unreadCount} unread
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && visibleNotifications.length === 0 ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-surface-subtle"
                  />
                ))}
              </div>
            ) : visibleNotifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">
                No notifications yet
              </p>
            ) : (
              visibleNotifications.slice(0, 12).map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "border-b border-border-subtle px-4 py-3 last:border-b-0 transition-colors flex items-start gap-3",
                    n.read ? "bg-surface" : "bg-primary-soft/30"
                  )}
                >
                  <SeverityIcon severity={n.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-foreground-subtle">
                      {n.message}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-muted">
                        {timeAgo(n.createdAt)}
                      </span>
                      <div className="flex items-center gap-3">
                        {n.actionUrl && (
                          <Link
                            href={n.actionUrl}
                            onClick={() => {
                              if (!n.read) void markRead(n.id);
                              setOpen(false);
                            }}
                            className="text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                          >
                            View
                          </Link>
                        )}
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => void markRead(n.id)}
                            className="text-xs font-medium text-muted hover:text-foreground-subtle"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => archiveNotification(n.id)}
                          className="text-xs font-medium text-danger-fg hover:text-danger hover:underline"
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border px-4 py-2 text-center bg-surface-subtle">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
