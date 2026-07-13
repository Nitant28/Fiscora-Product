import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";
import ExecutiveMetricCard from "../../components/ExecutiveMetricCard";
import { formatINR, formatINRCompact, formatPercent } from "../../lib/metrics";
import { getProcurementIntelligence } from "../../lib/procurement-analytics";

const SEVERITY = {
  HIGH: "border-red-200 bg-red-50 text-red-800",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-900",
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export default async function AnalyticsPage() {
  const data = await getProcurementIntelligence().catch(() => null);

  if (!data?.spend) {
    return (
      <PageContainer>
        <PageHeader title="Procurement Intelligence" />
        <div className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          Unable to load analytics. Ensure the API is running.
        </div>
      </PageContainer>
    );
  }

  const { spend, cycleTime, maverick, budget, vendors } = data;

  return (
    <PageContainer>
      <PageHeader
        title="Procurement Intelligence"
        description="Spend visibility, cycle time, maverick spend, budget risk, and vendor performance — the metrics procurement heads and CFOs actually review."
        actions={
          <Link href="/control-tower">
            <Button variant="outline">Control Tower</Button>
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ExecutiveMetricCard
          label="Total Spend"
          value={spend.totalSpend}
          format="inr"
          subtitle="Approved + paid invoices"
        />
        <ExecutiveMetricCard
          label="This Month"
          value={spend.monthlySpend}
          format="inr"
          subtitle="Current month spend"
        />
        <ExecutiveMetricCard
          label="Average Invoice"
          value={spend.averageInvoice ?? undefined}
          format="inr"
          displayText={
            spend.averageInvoice == null ? "Not enough data" : undefined
          }
          subtitle={`${spend.invoiceCount ?? 0} invoices`}
        />
        <ExecutiveMetricCard
          label="Average PO"
          value={spend.averagePO ?? undefined}
          format="inr"
          displayText={
            spend.averagePO == null ? "Not enough data" : undefined
          }
          subtitle={`${spend.poCount ?? 0} purchase orders`}
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Spend by Vendor</h2>
          <ul className="mt-4 space-y-3">
            {spend.spendByVendor.map((row) => (
              <li
                key={row.vendor}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{row.vendor}</span>
                <span>{formatINRCompact(row.spend)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Spend by Department</h2>
          <ul className="mt-4 space-y-3">
            {spend.spendByDepartment.map((row) => (
              <li
                key={row.department}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{row.department}</span>
                <span>{formatINRCompact(row.spend)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Procurement Cycle Time</h2>
        <p className="mt-1 text-sm text-gray-500">
          End-to-end cycle (complete chains only):{" "}
          <span className="font-semibold text-gray-900">
            {cycleTime.averageProcurementCycleLabel ??
              (cycleTime.averageProcurementCycleDays != null
                ? `${cycleTime.averageProcurementCycleDays} days`
                : "Not enough data")}
          </span>
          {cycleTime.completeChainCount != null && (
            <span className="text-gray-400">
              {" "}
              · {cycleTime.completeChainCount} full chains
            </span>
          )}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs uppercase text-gray-500">Request → Approval</p>
            <p className="mt-1 text-xl font-bold">{cycleTime.requestToApproval.label}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs uppercase text-gray-500">Approval → PO</p>
            <p className="mt-1 text-xl font-bold">{cycleTime.approvalToPO.label}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs uppercase text-gray-500">PO → Invoice</p>
            <p className="mt-1 text-xl font-bold">{cycleTime.poToInvoice.label}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs uppercase text-gray-500">Invoice → Payment</p>
            <p className="mt-1 text-xl font-bold">{cycleTime.invoiceToPayment.label}</p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h2 className="text-lg font-semibold text-rose-900">Maverick Spend</h2>
          <p className="mt-2 text-4xl font-bold text-rose-950">
            {formatINRCompact(maverick.maverickSpend)}
          </p>
          <p className="mt-1 text-sm text-rose-800">
            {maverick.maverickPercent != null
              ? formatPercent(maverick.maverickPercent)
              : "Not enough data"}{" "}
            of total spend · {maverick.count} cases
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {maverick.topCases.slice(0, 5).map((c) => (
              <li key={c.id} className="rounded-lg bg-white/70 px-3 py-2">
                <span className="font-medium">{c.vendorName}</span> —{" "}
                {formatINR(c.amount)}
                <span className="text-rose-700"> · {c.reasons.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Budget Forecast Alerts</h2>
          <p className="mt-1 text-sm text-gray-500">
            {budget.atRisk} department{budget.atRisk === 1 ? "" : "s"} at risk
          </p>
          <ul className="mt-4 space-y-3">
            {budget.forecasts
              .filter((f) => f.severity !== "LOW")
              .slice(0, 5)
              .map((f) => (
                <li
                  key={f.department}
                  className={`rounded-xl border p-4 ${SEVERITY[f.severity]}`}
                >
                  <p className="font-semibold">{f.department} Budget Risk</p>
                  <p className="mt-1 text-sm">{f.message}</p>
                  <p className="mt-2 text-xs">
                    Budget {formatINRCompact(f.budget)} · Burn{" "}
                    {formatINRCompact(f.monthlyBurn)}/mo
                  </p>
                </li>
              ))}
          </ul>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Vendor Performance Scorecard</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Vendor</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Accuracy</th>
                <th className="py-2 pr-4">Reliability</th>
                <th className="py-2 pr-4">Risk</th>
                <th className="py-2 pr-4">Pricing</th>
                <th className="py-2">Spend</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.vendorId} className="border-b">
                  <td className="py-3 pr-4 font-medium">{v.vendorName}</td>
                  <td className="py-3 pr-4">{Math.round(v.score)}/100</td>
                  <td className="py-3 pr-4">{v.breakdown.accuracy}</td>
                  <td className="py-3 pr-4">{v.breakdown.reliability}</td>
                  <td className="py-3 pr-4">{v.breakdown.risk}</td>
                  <td className="py-3 pr-4">{v.breakdown.pricing}</td>
                  <td className="py-3">{formatINRCompact(v.totalSpend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageContainer>
  );
}
