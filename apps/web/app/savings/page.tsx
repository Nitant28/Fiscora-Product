import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";
import ExecutiveMetricCard from "../../components/ExecutiveMetricCard";
import { formatINR } from "../../lib/metrics";
import { getSavingsDashboard } from "../../lib/savings";

const SEVERITY_STYLE = {
  HIGH: "bg-red-100 text-red-800",
  MEDIUM: "bg-amber-100 text-amber-900",
  LOW: "bg-emerald-100 text-emerald-900",
};

export default async function SavingsIntelligencePage() {
  const data = await getSavingsDashboard().catch(() => null);

  if (!data?.summary) {
    return (
      <PageContainer>
        <PageHeader title="Savings Intelligence" />
        <div className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          Unable to load savings data. Ensure the API is running.
        </div>
      </PageContainer>
    );
  }

  const { summary, monthlyReport } = data;

  return (
    <PageContainer>
      <PageHeader
        title="Savings Intelligence"
        description="ROI layer — how much Fiscora saved your organization through sourcing, negotiation, compliance, and fraud prevention."
        actions={
          <Link href="/dashboard">
            <Button variant="outline">Executive Dashboard</Button>
          </Link>
        }
      />

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8 shadow-card">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Annual Savings
        </p>
        <p className="mt-2 text-5xl font-bold text-gray-900">
          {formatINR(summary.annualSavings)}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-gray-500">RFQ Savings</p>
            <p className="text-xl font-semibold">
              {formatINR(summary.rfqSavings)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Contract Savings</p>
            <p className="text-xl font-semibold">
              {formatINR(summary.contractSavings)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Budget Avoidance</p>
            <p className="text-xl font-semibold">
              {formatINR(summary.budgetAvoidance)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">
              Vendor Consolidation
            </p>
            <p className="text-xl font-semibold">
              {formatINR(summary.vendorConsolidation)}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ExecutiveMetricCard
          label="Negotiated Savings"
          value={summary.negotiatedSavings}
          format="money"
          variant="green"
        />
        <ExecutiveMetricCard
          label="Avoided Spend"
          value={summary.avoidedSpend}
          format="money"
        />
        <ExecutiveMetricCard
          label="Fraud Prevented"
          value={summary.fraudPrevented}
          format="money"
          variant="green"
        />
        <ExecutiveMetricCard
          label="Contract Optimization"
          value={summary.contractOptimization}
          format="money"
        />
        <ExecutiveMetricCard
          label="Total Impact"
          value={summary.totalImpact}
          format="money"
          variant="green"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            Savings Opportunities
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Recommended actions with estimated impact
          </p>
          <div className="mt-4 space-y-4">
            {data.opportunities.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[item.severity as keyof typeof SEVERITY_STYLE] ?? SEVERITY_STYLE.MEDIUM}`}
                    >
                      {item.severity}
                    </span>
                    <h3 className="mt-2 font-medium">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {item.recommendation}
                    </p>
                    <p className="mt-2 text-sm font-medium text-emerald-700">
                      {item.impact}
                    </p>
                  </div>
                  {item.contractId ? (
                    <Link
                      href={`/contracts/intelligence`}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      Take action
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            CFO Monthly Report
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {monthlyReport.month}
          </p>
          <dl className="mt-6 space-y-4">
            <div className="flex justify-between border-b pb-3">
              <dt className="text-gray-600">Spend Controlled</dt>
              <dd className="font-semibold">
                {formatINR(monthlyReport.spendControlled)}
              </dd>
            </div>
            <div className="flex justify-between border-b pb-3">
              <dt className="text-gray-600">Savings Generated</dt>
              <dd className="font-semibold text-emerald-700">
                {formatINR(monthlyReport.savingsGenerated)}
              </dd>
            </div>
            <div className="flex justify-between border-b pb-3">
              <dt className="text-gray-600">Compliance Score</dt>
              <dd className="font-semibold">
                {monthlyReport.complianceScore}%
              </dd>
            </div>
            <div className="flex justify-between border-b pb-3">
              <dt className="text-gray-600">
                Fraud Alerts Prevented
              </dt>
              <dd className="font-semibold">
                {monthlyReport.fraudAlertsPrevented}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Top Risk Vendor</dt>
              <dd className="font-semibold">
                {monthlyReport.topRiskVendor}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Export PDF (coming soon)
          </button>
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            Top Procurement Wins
          </h2>
          <div className="mt-4 space-y-3">
            {data.topWins.map((win) => (
              <div
                key={win.title}
                className="flex items-center justify-between rounded-xl border px-4 py-3"
              >
                <div>
                  <p className="font-medium">{win.title}</p>
                  {win.vendorName && (
                    <p className="text-sm text-gray-500">
                      {win.vendorName}
                    </p>
                  )}
                </div>
                <p className="font-semibold text-emerald-700">
                  Saved {formatINR(win.amount)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            Department Savings
          </h2>
          <div className="mt-4 space-y-3">
            {data.departmentSavings.map((row) => (
              <div
                key={row.department}
                className="flex items-center justify-between"
              >
                <span className="font-medium">
                  {row.department}
                </span>
                <span className="text-emerald-700">
                  {formatINR(row.amount)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
