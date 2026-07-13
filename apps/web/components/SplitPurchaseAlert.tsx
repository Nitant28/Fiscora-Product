/**
 * SplitPurchaseAlert
 * Purpose: Flag related requests that may circumvent approval thresholds.
 * Data: Props from purchase-request fraud/split detection API.
 * Roles: request.approve, control.view.
 */
import Link from "next/link";
import { formatINR } from "../lib/metrics";

type SplitPurchaseRisk = {
  requestCount: number;
  combinedSpend: number;
  windowDays: number;
  requester: string;
  vendorName: string | null;
  requests: Array<{
    id: number;
    title: string;
    estimatedAmount: number;
  }>;
};

export default function SplitPurchaseAlert({
  risk,
}: {
  risk: SplitPurchaseRisk;
}) {
  return (
    <div className="mt-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠</span>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-amber-950">
            Potential Split Purchase
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            Multiple requests from{" "}
            <span className="font-medium">
              {risk.requester}
            </span>{" "}
            may be splitting spend to stay
            below approval limits.
          </p>

          <div className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Requests
              </p>
              <p className="text-2xl font-bold">
                {risk.requestCount}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Combined Spend
              </p>
              <p className="text-2xl font-bold text-amber-900">
                {formatINR(
                  risk.combinedSpend
                )}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Window
              </p>
              <p className="text-2xl font-bold">
                {risk.windowDays} days
              </p>
            </div>
          </div>

          {risk.vendorName && (
            <p className="mt-3 text-sm text-amber-800">
              Vendor:{" "}
              <span className="font-medium">
                {risk.vendorName}
              </span>
            </p>
          )}

          <div className="mt-4 space-y-2">
            {risk.requests.map((item) => (
              <Link
                key={item.id}
                href={`/requests/${item.id}`}
                className="flex items-center justify-between rounded-lg border border-amber-200 px-4 py-2 hover:bg-amber-100"
              >
                <span className="font-medium text-amber-950">
                  {item.title}
                </span>
                <span className="text-sm font-semibold">
                  {formatINR(
                    item.estimatedAmount
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
