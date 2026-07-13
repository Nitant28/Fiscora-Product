import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { getAuditSummary } from "../../lib/audit";

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <p className="kpi-label">{label}</p>
      <p className="mt-2 text-3xl font-bold financial-figure text-foreground">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export default async function AuditPage() {
  const summary = await getAuditSummary();

  return (
    <PageContainer rhythm>
      <PageHeader
        title="Audit Center"
        description="Forensic overview of protected actions, approvals, and risk signals."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Events" value={summary.totalEvents} />
        <SummaryCard label="Approvals" value={summary.approvals} />
        <SummaryCard label="Violations" value={summary.violations} />
        <SummaryCard label="Fraud Alerts" value={summary.fraudAlerts} />
      </div>
    </PageContainer>
  );
}
