import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { getCurrentUser } from "../../lib/api";
import { hasPermission, PERMISSION_KEYS } from "../../lib/permissions";

const IMPORT_LINKS = [
  {
    href: "/import/vendors",
    label: "Import Vendors",
    description: "Bulk upload vendor directory from CSV",
    permission: PERMISSION_KEYS.VENDOR_MANAGE,
  },
  {
    href: "/import/users",
    label: "Import Users",
    description: "Add team members with roles and departments",
    permission: PERMISSION_KEYS.USER_MANAGE,
  },
  {
    href: "/import/departments",
    label: "Import Departments",
    description: "Create departments with budgets in one step",
    permission: PERMISSION_KEYS.USER_MANAGE,
  },
  {
    href: "/import/budgets",
    label: "Import Budgets",
    description: "Update department budgets from CSV",
    permission: PERMISSION_KEYS.USER_MANAGE,
  },
];

export default async function ImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (
    !user ||
    (!hasPermission(user, PERMISSION_KEYS.USER_MANAGE) &&
      !hasPermission(user, PERMISSION_KEYS.VENDOR_MANAGE))
  ) {
    redirect("/dashboard");
  }

  const visibleLinks = IMPORT_LINKS.filter((link) =>
    hasPermission(user, link.permission)
  );

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Import Center"
        description="Migrate Excel data in minutes — vendors, users, departments, and budgets."
      />

      <nav className="-mt-2 mb-8 flex flex-wrap gap-2">
        <Link
          href="/import"
          className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground-subtle transition-colors hover:bg-surface-subtle hover:text-foreground"
        >
          Overview
        </Link>
        {visibleLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground-subtle transition-colors hover:bg-surface-subtle hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/onboarding"
          className="rounded-lg border border-primary-border bg-primary-soft px-3.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-soft-2"
        >
          Onboarding Wizard
        </Link>
      </nav>

      <div>{children}</div>
    </PageContainer>
  );
}
