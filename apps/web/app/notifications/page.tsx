/**
 * Notifications — full notification center (Sprint 18C.1).
 * Data: GET /notifications via apiFetch.
 */
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { EmptyState } from "@repo/ui/empty-state";
import { apiFetch } from "../../lib/api";
import MarkAllReadButton from "../../components/MarkAllReadButton";

const SEVERITY_STYLES: Record<string, string> = {
  INFO: "border-l-blue-500",
  WARNING: "border-l-amber-500",
  CRITICAL: "border-l-red-500",
};

export default async function NotificationsPage() {
  const res = await apiFetch("/notifications");

  if (!res.ok) {
    return (
      <PageContainer width="narrow">
        <div className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          Unable to load notifications. Please try again.
        </div>
      </PageContainer>
    );
  }

  const data = await res.json();
  const notifications = data.notifications ?? [];
  const unreadCount = data.unreadCount ?? 0;

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        actions={unreadCount > 0 ? <MarkAllReadButton /> : undefined}
      />

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Approvals, invoices, contracts, and team activity will appear here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map(
            (n: {
              id: number;
              title: string;
              message: string;
              type: string;
              severity: string;
              actionUrl: string | null;
              read: boolean;
              createdAt: string;
            }) => (
              <div
                key={n.id}
                className={`rounded-xl border border-border border-l-4 bg-surface p-5 shadow-card ${
                  SEVERITY_STYLES[n.severity] ??
                  SEVERITY_STYLES.INFO
                } ${!n.read ? "ring-1 ring-primary-soft" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">
                      {n.title}
                    </p>
                    <p className="mt-1 text-sm text-foreground-subtle">
                      {n.message}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      {new Date(
                        n.createdAt
                      ).toLocaleString()}
                      {!n.read && (
                        <span className="ml-2 rounded bg-primary-soft px-1.5 py-0.5 text-primary">
                          New
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {n.actionUrl && (
                      <Link
                        href={n.actionUrl}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
                      >
                        Open
                      </Link>
                    )}
                    {!n.read && (
                      <Link
                        href={`/api/proxy/notifications/${n.id}/read`}
                        className="text-center text-xs text-muted hover:underline"
                      >
                        Mark read
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </PageContainer>
  );
}
