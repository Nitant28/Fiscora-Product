/**
 * CFO Dashboard
 * Purpose: Cash forecast — upcoming payment outflow by horizon and vendor concentration.
 * Data: GET /analytics/cfo (apiFetch).
 * Roles: CFO, Director, Procurement, Admin (cashforecast.view).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";
import type { CfoDashboardData } from "../../lib/analytics-types";
import { canViewCfoDashboard } from "../../lib/auth";
import { apiFetch, getCurrentUser } from "../../lib/api";
import {
  formatINR,
  formatINRCompact,
} from "../../lib/metrics";

type LoadResult =
  | { ok: true; data: CfoDashboardData }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "unauthorized"
        | "api_error";
      message: string;
    };

async function getCfoDashboard(): Promise<LoadResult> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?from=/cfo");
  }

  if (!canViewCfoDashboard(user)) {
    return {
      ok: false,
      reason: "forbidden",
      message:
        "Your role does not have access to the CFO dashboard. Sign in as CFO, Director, Procurement, or Admin.",
    };
  }

  const res = await apiFetch("/analytics/cfo");

  if (res.status === 401) {
    redirect("/login?from=/cfo");
  }

  if (res.status === 403) {
    return {
      ok: false,
      reason: "forbidden",
      message:
        "Insufficient permissions to view cash forecast data.",
    };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      reason: "api_error",
      message:
        body.error ??
        `Failed to load CFO dashboard (HTTP ${res.status}). Ensure the API server is running on port 4000.`,
    };
  }

  const json = await res.json();
  const data = json.data as CfoDashboardData | undefined;

  if (!data) {
    return {
      ok: false,
      reason: "api_error",
      message: "CFO dashboard returned an empty response.",
    };
  }

  return { ok: true, data };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

export default async function CfoDashboardPage() {
  const result = await getCfoDashboard();

  if (!result.ok) {
    return (
      <PageContainer>
        <PageHeader title="CFO Dashboard" />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-medium text-amber-900">
            {result.reason === "forbidden"
              ? "Access restricted"
              : "Unable to load cash forecast"}
          </p>
          <p className="mt-2 text-sm text-amber-800">
            {result.message}
          </p>
          {result.reason === "api_error" && (
            <p className="mt-3 text-sm text-amber-700">
              Restart the API with{" "}
              <code className="rounded bg-amber-100 px-1">
                cd apps/api && pnpm dev
              </code>
            </p>
          )}
        </div>
      </PageContainer>
    );
  }

  const data = result.data;

  return (
    <PageContainer>
      <PageHeader
        title="CFO Dashboard"
        description="Cash forecast command center — future outflow from scheduled vendor payments"
      />

      {/* --- CASH FORECAST CARDS --- */}
      <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ForecastCard
          label="Cash Due"
          period="Next 7 Days"
          amount={data.sevenDayOutflow}
          tone="red"
        />
        <ForecastCard
          label="Cash Due"
          period="Next 30 Days"
          amount={data.thirtyDayOutflow}
          tone="amber"
        />
        <ForecastCard
          label="Cash Due"
          period="Next 90 Days"
          amount={data.ninetyDayOutflow}
          tone="blue"
        />
      </div>

      {/* --- UPCOMING PAYMENTS & TOP VENDORS --- */}
      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-xl font-semibold">
            Upcoming Payments
          </h2>

          {data.upcomingPayments.length === 0 ? (
            <p className="text-sm text-gray-500">
              No unpaid payments due in the next 90
              days.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="px-4 py-3">
                      Vendor
                    </th>
                    <th className="px-4 py-3">
                      Invoice
                    </th>
                    <th className="px-4 py-3">
                      Amount
                    </th>
                    <th className="px-4 py-3">
                      Due Date
                    </th>
                    <th className="px-4 py-3">
                      Days Remaining
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcomingPayments.map(
                    (payment) => (
                      <tr
                        key={payment.id}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="px-4 py-4 font-medium">
                          <Link
                            href={`/vendors/${payment.vendorId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {payment.vendorName}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/invoices/${payment.invoiceId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {
                              payment.invoiceNumber
                            }
                          </Link>
                        </td>
                        <td className="px-4 py-4 font-medium">
                          {formatINR(
                            payment.amount
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {formatDate(
                            payment.dueDate
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <DaysRemaining
                            days={
                              payment.daysRemaining
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">
            Top Cash Consumers
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Unpaid outflow by vendor (next 90 days)
          </p>

          {data.topVendors.length === 0 ? (
            <p className="text-sm text-gray-500">
              No vendor outflow scheduled.
            </p>
          ) : (
            <div className="space-y-4">
              {data.topVendors.map((vendor) => (
                <div
                  key={vendor.vendorId}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <Link
                      href={`/vendors/${vendor.vendorId}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {vendor.vendorName}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {vendor.paymentCount}{" "}
                      payment
                      {vendor.paymentCount === 1
                        ? ""
                        : "s"}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatINRCompact(
                      vendor.totalAmount
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* --- PAYMENT STATUS MIX --- */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">
          Payment Status Mix
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Pipeline bottlenecks across all payments
        </p>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {data.paymentStatusMix.map((item) => (
            <div
              key={item.status}
              className="rounded-xl border p-4"
            >
              <StatusBadge
                status={item.status}
              />
              <p className="mt-3 text-2xl font-bold">
                {item.count}
              </p>
              <p className="text-sm text-gray-500">
                {formatINRCompact(item.amount)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}

function ForecastCard({
  label,
  period,
  amount,
  tone,
}: {
  label: string;
  period: string;
  amount: number;
  tone: "red" | "amber" | "blue";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-blue-200 bg-blue-50";

  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm ${toneClass}`}
    >
      <p className="text-sm font-medium text-gray-600">
        {label}
      </p>
      <p className="text-lg font-semibold text-gray-800">
        {period}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight">
        {formatINR(amount)}
      </p>
    </div>
  );
}

function DaysRemaining({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="font-medium text-red-700">
        {Math.abs(days)} days overdue
      </span>
    );
  }

  if (days === 0) {
    return (
      <span className="font-medium text-red-700">
        Due today
      </span>
    );
  }

  if (days <= 7) {
    return (
      <span className="font-medium text-amber-700">
        {days} days
      </span>
    );
  }

  return (
    <span className="text-gray-700">
      {days} days
    </span>
  );
}
