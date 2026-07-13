"use client";

type Plan = {
  slug: string;
  name: string;
  description: string | null;
  priceLabel: string;
  seatLimit: number | null;
  features: { key: string; name: string }[];
};

type Subscription = {
  status: string;
  trialEndsAt: string | null;
  trialExpired: boolean;
  currentPeriodEnd: string | null;
  plan: { slug: string; name: string; priceLabel: string; seatLimit: number | null };
  usage: {
    seatsUsed: number;
    seatLimit: number | null;
    seatsRemaining: number | null;
    atSeatLimit: boolean;
  };
  features: string[];
};

type Invoice = {
  id: number;
  invoiceNumber: string | null;
  amount: number;
  status: string;
  createdAt: string;
};

function statusTone(status: string) {
  switch (status) {
    case "ACTIVE":
    case "TRIAL":
      return "bg-green-100 text-green-800";
    case "PAST_DUE":
      return "bg-amber-100 text-amber-800";
    case "CANCELLED":
    case "EXPIRED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function BillingClient({
  subscription,
  plans,
  invoices,
  canManage,
}: {
  subscription: Subscription | null;
  plans: Plan[];
  invoices: Invoice[];
  canManage: boolean;
}) {
  async function changePlan(slug: string) {
    if (!canManage) return;
    const res = await fetch(
      "/api/proxy/billing/subscription/change-plan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug: slug }),
      }
    );
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json();
      alert(data.error ?? "Could not change plan");
    }
  }

  if (!subscription) {
    return (
      <div className="rounded-xl border bg-white p-8 text-gray-500">
        Billing data unavailable.
      </div>
    );
  }

  const seatPct =
    subscription.usage.seatLimit != null
      ? Math.min(
          100,
          Math.round(
            (subscription.usage.seatsUsed /
              subscription.usage.seatLimit) *
              100
          )
        )
      : null;

  return (
    <div className="space-y-8">
      {/* Current plan */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
              Current plan
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {subscription.plan.name}
            </h2>
            <p className="text-lg text-gray-600">
              {subscription.plan.priceLabel}
              {subscription.plan.priceLabel !== "Custom" && (
                <span className="text-sm text-gray-400"> / month</span>
              )}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusTone(subscription.status)}`}
          >
            {subscription.status}
          </span>
        </div>

        {subscription.status === "TRIAL" && subscription.trialEndsAt && (
          <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {subscription.trialExpired ? "Trial ended" : "Trial ends"}{" "}
            {new Date(subscription.trialEndsAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . Connect Razorpay in Sprint 20 to collect payment.
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase text-gray-500">
              Seats used
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {subscription.usage.seatsUsed}
              {subscription.usage.seatLimit != null && (
                <span className="text-base font-normal text-gray-500">
                  {" "}
                  / {subscription.usage.seatLimit}
                </span>
              )}
            </p>
            {seatPct != null && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${seatPct >= 90 ? "bg-red-500" : "bg-blue-500"}`}
                  style={{ width: `${seatPct}%` }}
                />
              </div>
            )}
            {subscription.usage.atSeatLimit && (
              <p className="mt-2 text-xs text-red-600">
                Seat limit reached — upgrade to add more users.
              </p>
            )}
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase text-gray-500">
              Enabled features
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {subscription.features.map((f) => (
                <li
                  key={f}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                >
                  {f.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Plans */}
      {canManage && (
        <section>
          <h3 className="mb-4 text-lg font-semibold">Available plans</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const current = plan.slug === subscription.plan.slug;
              return (
                <div
                  key={plan.slug}
                  className={`rounded-xl border bg-white p-5 shadow-sm ${current ? "ring-2 ring-blue-500" : ""}`}
                >
                  <h4 className="font-bold">{plan.name}</h4>
                  <p className="mt-1 text-2xl font-semibold">
                    {plan.priceLabel}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    {plan.description}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    {plan.seatLimit != null
                      ? `Up to ${plan.seatLimit} users`
                      : "Unlimited users"}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-gray-600">
                    {plan.features.slice(0, 5).map((f) => (
                      <li key={f.key}>✓ {f.name}</li>
                    ))}
                  </ul>
                  <button
                    onClick={() => changePlan(plan.slug)}
                    disabled={current}
                    className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {current ? "Current plan" : "Select plan"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Dev mode: plan changes apply immediately without payment. Razorpay
            checkout connects in Sprint 20.
          </p>
        </section>
      )}

      {/* Invoices */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Invoices</h3>
        {invoices.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No invoices yet. Invoices are generated when payment is connected.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-gray-500">
                <th className="py-2">Number</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b">
                  <td className="py-2">{inv.invoiceNumber ?? `#${inv.id}`}</td>
                  <td className="py-2">
                    ₹{(inv.amount / 100).toLocaleString("en-IN")}
                  </td>
                  <td className="py-2">{inv.status}</td>
                  <td className="py-2">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
