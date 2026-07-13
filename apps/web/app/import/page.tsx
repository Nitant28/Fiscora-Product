import Link from "next/link";

const CARDS = [
  {
    href: "/import/vendors",
    title: "Import Vendors",
    description: "Upload name, email, and payment terms for your vendor master.",
    stat: "60 sec for 500 rows",
  },
  {
    href: "/import/users",
    title: "Import Users",
    description: "Add employees with roles and department assignments.",
    stat: "Role validation included",
  },
  {
    href: "/import/departments",
    title: "Import Departments",
    description: "Create Finance, IT, Marketing with budgets in one file.",
    stat: "Department + budget",
  },
  {
    href: "/import/budgets",
    title: "Import Budgets",
    description: "Update department budgets without recreating departments.",
    stat: "Budget > 0 validation",
  },
];

export default function ImportCenterPage() {
  return (
    <div className="space-y-6">
      <p className="text-foreground-subtle">
        Every enterprise customer has Excel. Import Center gets them live in under
        5 minutes — no developer, no Prisma Studio.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-border bg-surface p-6 shadow-card transition hover:border-primary/40 hover:shadow-card-hover"
          >
            <h2 className="text-xl font-semibold text-foreground">{card.title}</h2>
            <p className="mt-2 text-sm text-muted">{card.description}</p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-primary">
              {card.stat}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
