import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { formatINR } from "../../lib/metrics";
import { getRoiDashboard } from "../../lib/roi";

export default async function RoiPage() {
  const data = await getRoiDashboard().catch(() => null);

  if (!data?.pillars) {
    return (
      <PageContainer>
        <PageHeader title="ROI" />
        <div className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          Unable to load ROI metrics. Sign in as CFO and ensure the API is
          running.
        </div>
      </PageContainer>
    );
  }

  const pillars = Object.values(data.pillars);

  return (
    <PageContainer width="wide">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
          Fiscora ROI
        </p>
        <h1 className="mt-3 text-5xl font-bold text-gray-900">
          {data.headline}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          Measurable impact — not workflow features. This is what your board
          and CFO care about.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {pillars.map((pillar) => (
          <section
            key={pillar.label}
            className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">
              {pillar.label}
            </p>
            <p className="mt-2 text-4xl font-bold text-gray-900">
              {pillar.display}
            </p>
            <p className="mt-3 text-sm text-gray-600">
              {pillar.detail}
            </p>
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
        <h2 className="text-xl font-semibold text-emerald-900">
          Proof points
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.proofPoints.map((point) => (
            <div
              key={point.label}
              className="rounded-2xl bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-xs text-gray-500">{point.label}</p>
              <p className="mt-1 text-lg font-semibold">{point.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Top wins</h2>
          <div className="mt-4 space-y-3">
            {data.topWins.map((win) => (
              <div
                key={win.title}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <span className="font-medium">{win.title}</span>
                <span className="text-emerald-700">
                  {formatINR(win.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            {data.monthlyReport.month}
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt>Spend controlled</dt>
              <dd className="font-semibold">
                {formatINR(data.monthlyReport.spendControlled)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Savings generated</dt>
              <dd className="font-semibold text-emerald-700">
                {formatINR(data.monthlyReport.savingsGenerated)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Compliance</dt>
              <dd className="font-semibold">
                {data.monthlyReport.complianceScore}%
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/savings"
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Savings Intelligence
        </Link>
        <Link
          href="/dashboard"
          className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium hover:bg-gray-50"
        >
          Executive Dashboard
        </Link>
      </div>
    </PageContainer>
  );
}
