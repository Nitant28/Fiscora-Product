/**
 * Control Tower
 * Purpose: Procurement operations cockpit — risk alerts, PO pipeline, budget thresholds, pending work.
 * Data: GET /control-tower (apiFetch).
 * Roles: Users with control.view; CFO link when cashforecast.view.
 */
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { formatMoney, formatINR } from "../../lib/metrics";
import { apiFetch, getCurrentUser } from "../../lib/api";
import { canViewCfoDashboard } from "../../lib/auth";

async function getControlTower() {
  const res = await apiFetch("/control-tower");
  if (!res.ok) return null;
  return res.json();
}

export default async function ControlTowerPage() {
  const [result, user] = await Promise.all([
    getControlTower(),
    getCurrentUser(),
  ]);
  const data = result?.data;
  const showCfoLink = canViewCfoDashboard(user);

  if (!data) {
    return (
      <PageContainer>
        <PageHeader title="Procurement Control Tower" />
        <div className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          Control tower unavailable. Ensure the API is running.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Procurement Control Tower"
        description="CFO morning view — control, visibility, compliance"
      />

      {/* --- CFO CASH OUTFLOW LINK --- */}
      {showCfoLink && (
        <Link
          href="/cfo"
          className="mb-6 block rounded-2xl border border-violet-200 bg-violet-50 p-6 shadow-sm transition hover:border-violet-300 hover:bg-violet-100"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-violet-800">
                Upcoming Cash Outflow
              </p>
              <p className="mt-1 text-3xl font-bold text-violet-950">
                {formatINR(
                  data.cashOutflow?.next30Days ??
                    data.paymentsDueThisMonth ??
                    0
                )}
              </p>
              <p className="mt-1 text-sm text-violet-700">
                Due in the next 30 days
              </p>
            </div>
            <span className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white">
              Open CFO Dashboard →
            </span>
          </div>
        </Link>
      )}

      {/* --- CONTRACT RISKS --- */}
      {data.contractRisks && (
        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Contract Risks
              </h2>
              <p className="text-sm text-gray-500">
                Executive visibility — expiry and renewal exposure
              </p>
            </div>
            <Link
              href="/contracts/renewals"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Open Renewal Queue →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ContractRiskCard
              label="Expired Contracts"
              value={data.contractRisks.expired ?? 0}
              tone="red"
            />
            <ContractRiskCard
              label="Expiring in 30 Days"
              value={
                data.contractRisks.expiringIn30Days ?? 0
              }
              tone="orange"
            />
            <ContractRiskCard
              label="Expiring in 60 Days"
              value={
                data.contractRisks.expiringIn60Days ?? 0
              }
              tone="amber"
            />
            <ContractRiskCard
              label="Expiring in 90 Days"
              value={
                data.contractRisks.expiringIn90Days ?? 0
              }
              tone="yellow"
            />
          </div>
        </section>
      )}

      {/* --- RISK ALERTS --- */}
      {((data.riskAlerts?.total ??
        0) > 0 ||
        (data.fraudAlertCount ?? 0) > 0 ||
        (data.splitPurchaseAlertCount ??
          0) > 0) && (
        <div className="mb-10 rounded-2xl border-2 border-red-300 bg-red-50 p-6 shadow-sm">
          <p className="text-sm font-medium text-red-800">
            Risk Alerts
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-red-200 bg-white p-4">
              <p className="text-sm text-red-700">
                Duplicate Invoice
              </p>
              <p className="mt-1 text-3xl font-bold text-red-950">
                {data.riskAlerts
                  ?.duplicateInvoices ??
                  data.fraudAlertCount ??
                  0}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white p-4">
              <p className="text-sm text-amber-800">
                Split Purchase
              </p>
              <p className="mt-1 text-3xl font-bold text-amber-950">
                {data.riskAlerts
                  ?.splitPurchases ??
                  data.splitPurchaseAlertCount ??
                  0}
              </p>
            </div>
          </div>

          {(data.fraudAlerts?.length > 0 ||
            data.splitPurchaseAlerts
              ?.length > 0) && (
            <div className="mt-4 space-y-2">
              {data.fraudAlerts?.map(
                (alert: {
                  id: number;
                  invoiceNumber: string;
                  vendorName: string;
                  amount: number;
                }) => (
                  <Link
                    key={`inv-${alert.id}`}
                    href={`/invoices/${alert.id}`}
                    className="flex items-center justify-between rounded-lg border border-red-200 bg-white px-4 py-3 hover:bg-red-50"
                  >
                    <div>
                      <p className="text-xs font-medium uppercase text-red-700">
                        Duplicate Invoice
                      </p>
                      <p className="font-medium text-red-900">
                        {alert.invoiceNumber}
                      </p>
                      <p className="text-sm text-red-700">
                        {alert.vendorName}
                      </p>
                    </div>
                    <p className="font-semibold text-red-900">
                      {formatINR(alert.amount)}
                    </p>
                  </Link>
                )
              )}
              {data.splitPurchaseAlerts?.map(
                (alert: {
                  id: number;
                  title: string;
                  requester: string;
                  combinedSpend: number;
                  requestCount: number;
                }) => (
                  <Link
                    key={`req-${alert.id}`}
                    href={`/requests/${alert.id}`}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-3 hover:bg-amber-50"
                  >
                    <div>
                      <p className="text-xs font-medium uppercase text-amber-800">
                        Split Purchase
                      </p>
                      <p className="font-medium text-amber-950">
                        {alert.title}
                      </p>
                      <p className="text-sm text-amber-800">
                        {alert.requester} ·{" "}
                        {alert.requestCount}{" "}
                        requests
                      </p>
                    </div>
                    <p className="font-semibold text-amber-950">
                      {formatINR(
                        alert.combinedSpend
                      )}
                    </p>
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* --- OPERATIONS METRICS --- */}
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-6">
        <Metric
          label="Pending Requests"
          value={data.pendingRequests}
        />
        <Metric
          label="Pending Invoices"
          value={data.pendingInvoices}
        />
        <Metric
          label="POs Awaiting Receipt"
          value={data.posAwaitingReceipt}
        />
        <Metric
          label="Awaiting Receipt"
          value={
            data.posAwaitingReceipt ?? 0
          }
        />
        <Metric
          label="Partially Received"
          value={
            data.posPartiallyReceived ?? 0
          }
        />
        <Metric
          label="Fully Received"
          value={data.posFullyReceived ?? 0}
        />
        <Metric
          label="POs Awaiting Acceptance"
          value={
            data.posAwaitingAcceptance ?? 0
          }
        />
        <Metric
          label="POs In Transit"
          value={data.posInTransit ?? 0}
        />
        <Metric
          label="POs Closed"
          value={data.posClosed ?? 0}
        />
        <Metric
          label="Spend This Month"
          value={formatMoney(
            data.spendThisMonth
          )}
          raw
        />
        <Metric
          label="PO Savings This Month"
          value={formatMoney(
            data.poSavingsThisMonth ??
              data.savingsThisMonth ??
              0
          )}
          raw
        />
        <Metric
          label="Sourcing Savings This Month"
          value={formatMoney(
            data.rfqSavingsThisMonth ?? 0
          )}
          raw
        />
        <Metric
          label="Payments Completed This Month"
          value={formatMoney(
            data.paymentsCompletedThisMonth ??
              0
          )}
          raw
        />
        <Metric
          label="High Risk Vendors"
          value={
            data.highConcentrationVendorCount ??
            0
          }
          highlight={
            (data.highConcentrationVendorCount ??
              0) > 0
          }
        />
        <Metric
          label="Contracts Requiring Action"
          value={
            data.contractsRequiringAction ?? 0
          }
          highlight={
            (data.contractsRequiringAction ??
              0) > 0
          }
        />
      </div>

      {/* --- VENDOR CONCENTRATION --- */}
      {(data.highConcentrationVendorCount ??
        0) > 0 &&
        data.topVendorDependencyRisk && (
          <div className="mb-10 rounded-2xl border-2 border-orange-200 bg-orange-50 p-6 shadow-sm">
            <p className="text-sm font-medium text-orange-800">
              Vendor Concentration Risk
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-2xl font-bold text-orange-950">
                  {
                    data.topVendorDependencyRisk
                      .name
                  }
                </p>
                <p className="mt-1 text-sm text-orange-800">
                  {formatMoney(
                    data.topVendorDependencyRisk
                      .spend
                  )}{" "}
                  ·{" "}
                  {
                    data.highConcentrationVendorCount
                  }{" "}
                  vendors at HIGH or CRITICAL
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-orange-950">
                  {
                    data.topVendorDependencyRisk
                      .share
                  }
                  %
                </p>
                <p className="mt-1 text-sm font-semibold uppercase text-red-700">
                  {
                    data.topVendorDependencyRisk
                      .risk
                  }
                </p>
              </div>
            </div>
          </div>
        )}

      {/* --- BUDGET THRESHOLDS --- */}
      {data.departmentsExceeding80?.length > 0 && (
        <BudgetThresholdSection
          title="Departments Exceeding 80% Encumbered"
          departments={data.departmentsExceeding80}
          tone="amber"
        />
      )}

      {data.departmentsExceeding90?.length > 0 && (
        <BudgetThresholdSection
          title="Departments Exceeding 90% Encumbered"
          departments={data.departmentsExceeding90}
          tone="orange"
        />
      )}

      {data.departmentsExceeding100?.length > 0 && (
        <BudgetThresholdSection
          title="Departments Exceeding 100% Encumbered"
          departments={data.departmentsExceeding100}
          tone="red"
        />
      )}

      {/* --- BUDGET ALERTS --- */}
      {data.budgetAlerts?.length > 0 && (
        <section className="mb-10 rounded-2xl border-2 border-red-200 bg-red-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-red-900">
            Budget Alerts
          </h2>
          <div className="space-y-2">
            {data.budgetAlerts.map(
              (a: {
                department: string;
                utilization: number;
                available: number;
              }) => (
                <p
                  key={a.department}
                  className="text-sm text-red-800"
                >
                  {a.department}:{" "}
                  {a.utilization}% encumbered ·{" "}
                  {formatMoney(a.available)}{" "}
                  available
                </p>
              )
            )}
          </div>
        </section>
      )}

      {/* --- EXPIRING CONTRACTS --- */}
      {data.expiringContracts?.length > 0 && (
        <section className="mb-10 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-amber-900">
            Expiring Contracts
          </h2>
          <div className="space-y-2">
            {data.expiringContracts.map(
              (c: {
                id: number;
                title: string;
                vendor: string;
                vendorId: number;
                endDate: string;
                value: number;
                daysRemaining: number;
                severity: string;
                autoRenew: boolean;
              }) => (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-4 py-3 hover:bg-amber-100"
                >
                  <div>
                    <p className="font-medium text-amber-950">
                      {c.title}
                    </p>
                    <p className="text-sm text-amber-800">
                      {c.vendor} · expires{" "}
                      {new Date(
                        c.endDate
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-amber-950">
                      {c.daysRemaining} Days
                      Remaining
                    </p>
                    <p
                      className={`text-xs font-semibold uppercase ${
                        c.severity ===
                        "CRITICAL"
                          ? "text-red-700"
                          : c.severity ===
                              "WARNING"
                            ? "text-amber-800"
                            : "text-blue-700"
                      }`}
                    >
                      {c.severity}
                    </p>
                  </div>
                </Link>
              )
            )}
          </div>
        </section>
      )}

      {/* --- PENDING APPROVALS --- */}
      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Pending Approvals
          </h2>
          {!data.pendingApprovals?.length ? (
            <p className="text-gray-400">
              None
            </p>
          ) : (
            <ul className="space-y-3">
              {data.pendingApprovals.map(
                (item: {
                  id: number;
                  title: string;
                  amount: number;
                  approver: string | null;
                }) => (
                  <li key={item.id}>
                    <Link
                      href={`/requests/${item.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <span className="text-sm text-gray-500">
                      {" "}
                      ·{" "}
                      {formatMoney(
                        item.amount
                      )}{" "}
                      → {item.approver}
                    </span>
                  </li>
                )
              )}
            </ul>
          )}
        </section>
      </div>

      {data.poCycleTimeHours != null && (
        <p className="mb-6 text-sm text-gray-600">
          Average PO cycle time:{" "}
          {data.poCycleTimeHours}h (send →
          receive)
        </p>
      )}

      {/* --- RECENT ACTIVITY --- */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          Recent Activity
        </h2>
        {!data.recentActivity?.length ? null : (
          <ul className="space-y-2 text-sm">
            {data.recentActivity.map(
              (log: {
                id: number;
                action: string;
                actor: string;
                entityType: string;
                createdAt: string;
              }) => (
                <li
                  key={log.id}
                  className="text-gray-700"
                >
                  {log.action} ·{" "}
                  {log.entityType} ·{" "}
                  {log.actor} ·{" "}
                  {new Date(
                    log.createdAt
                  ).toLocaleString()}
                </li>
              )
            )}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}

function Metric({
  label,
  value,
  raw,
  highlight,
}: {
  label: string;
  value: string | number;
  raw?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        highlight
          ? "border-orange-300 bg-orange-50"
          : ""
      }`}
    >
      <p
        className={`text-sm ${
          highlight
            ? "text-orange-800"
            : "text-gray-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${
          highlight
            ? "text-orange-950"
            : ""
        }`}
      >
        {raw ? value : value}
      </p>
    </div>
  );
}

function BudgetThresholdSection({
  title,
  departments,
  tone,
}: {
  title: string;
  departments: {
    department: string;
    utilization: number;
    available: number;
    reservedBudget: number;
    committedBudget: number;
    spentBudget: number;
  }[];
  tone: "amber" | "orange" | "red";
}) {
  const styles = {
    amber:
      "border-amber-200 bg-amber-50 text-amber-900",
    orange:
      "border-orange-200 bg-orange-50 text-orange-900",
    red: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <section
      className={`mb-10 rounded-2xl border-2 p-6 ${styles[tone]}`}
    >
      <h2 className="mb-4 text-lg font-semibold">
        {title}
      </h2>
      <div className="space-y-2">
        {departments.map((d) => (
          <p key={d.department} className="text-sm">
            {d.department}: {d.utilization}% encumbered
            · {formatMoney(d.available)} available
            (R: {formatMoney(d.reservedBudget)} · C:{" "}
            {formatMoney(d.committedBudget)} · S:{" "}
            {formatMoney(d.spentBudget)})
          </p>
        ))}
      </div>
    </section>
  );
}

function ContractRiskCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "orange" | "amber" | "yellow";
}) {
  const styles = {
    red: "border-red-200 bg-red-50 text-red-950",
    orange:
      "border-orange-200 bg-orange-50 text-orange-950",
    amber:
      "border-amber-200 bg-amber-50 text-amber-950",
    yellow:
      "border-yellow-200 bg-yellow-50 text-yellow-950",
  };

  return (
    <div
      className={`rounded-2xl border-2 p-6 shadow-sm ${styles[tone]}`}
    >
      <p className="text-sm font-medium opacity-80">
        {label}
      </p>
      <p className="mt-2 text-4xl font-bold">
        {value}
      </p>
    </div>
  );
}
