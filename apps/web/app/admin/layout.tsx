import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { getCurrentUser } from "../../lib/api";
import { hasPermission, PERMISSION_KEYS } from "../../lib/permissions";

const ADMIN_LINKS = [
  { href: "/admin/identity", label: "Identity" },
  { href: "/admin/system", label: "Monitoring" },
  { href: "/admin/errors", label: "Errors" },
  { href: "/admin/queues", label: "Queues" },
  { href: "/admin/backups", label: "Backups" },
  { href: "/admin/permissions", label: "Permissions" },
  { href: "/admin/audit", label: "Audit Center" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (
    !user ||
    (!hasPermission(user, PERMISSION_KEYS.SYSTEM_VIEW) &&
      !hasPermission(user, PERMISSION_KEYS.USER_MANAGE) &&
      !hasPermission(user, PERMISSION_KEYS.ROLE_MANAGE))
  ) {
    redirect("/dashboard");
  }

  return (
    <PageContainer>
      <PageHeader
        title="System Admin"
        description="Monitoring, error tracking, queue status, and disaster recovery for enterprise deployments."
      />

      <nav className="-mt-2 mb-8 flex flex-wrap gap-2">
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground-subtle transition-colors hover:bg-surface-subtle hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </PageContainer>
  );
}
