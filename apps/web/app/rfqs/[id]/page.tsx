/**
 * RFQ Detail
 * Purpose: Bids, vendor recommendations, award, and PO generation for a sourcing event.
 * Data: GET /rfqs/:id, /bids, /recommendation, GET /vendors (direct API fetch).
 * Roles: rfq.view; rfq.award, rfq.manage for procurement actions.
 */
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import RFQExecutivePanel from "../../../components/RFQExecutivePanel";
import RFQProcurementSection from "../../../components/RFQProcurementSection";
import RFQAwardButton from "../../../components/RFQAwardButton";
import RFQBidForm from "../../../components/RFQBidForm";
import {
  formatINR,
  formatINRCompact,
  formatText,
} from "../../../lib/metrics";
import { apiFetch, getCurrentUser } from "../../../lib/api";

type RFQDetail = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  category: { name: string };
  createdBy: { name: string };
  awardedVendor: { id: number; name: string } | null;
  savings: {
    highestBid: number;
    winningBid: number;
    savings: number;
    vendor: { name: string };
  } | null;
  purchaseOrder: {
    id: number;
    poNumber: string;
    vendorName: string;
    amount: number;
    status: string;
  } | null;
};

type Bid = {
  id: number;
  vendorId: number;
  quotedAmount: number;
  leadTimeDays: number;
  warrantyMonths: number;
  score: number;
  vendor: { id: number; name: string };
};

type Recommendation = {
  recommendedVendor: string;
  score: number;
  reason: string;
  recommendation: {
    vendorId: number;
    vendorName: string;
    score: number;
    explanation: string;
  };
};

type Vendor = {
  id: number;
  name: string;
};

async function fetchJSON<T>(
  path: string
): Promise<T | null> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function RFQDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rfqId = Number(id);

  const [rfqData, bidsData, recData, vendorsData, user] =
    await Promise.all([
      fetchJSON<{ rfq: RFQDetail }>(
        `/rfqs/${rfqId}`
      ),
      fetchJSON<{ bids: Bid[] }>(
        `/rfqs/${rfqId}/bids`
      ),
      fetchJSON<Recommendation>(
        `/rfqs/${rfqId}/recommendation`
      ),
      fetchJSON<{ vendors: Vendor[] }>(
        "/vendors"
      ),
      getCurrentUser(),
    ]);

  const rfq = rfqData?.rfq;

  if (!rfq) {
    return (
      <PageContainer>
        <PageHeader title="RFQ not found" backHref="/rfqs" />
      </PageContainer>
    );
  }

  const bids = bidsData?.bids ?? [];
  const recommendation = recData;
  const vendors = vendorsData?.vendors ?? [];

  const recommendedVendorId =
    recommendation?.recommendation
      ?.vendorId ?? null;

  const canAcceptBids =
    rfq.status !== "AWARDED" &&
    rfq.status !== "CLOSED";

  const isOpen = rfq.status === "OPEN";
  const hasScores = bids.some((b) => b.score > 0);

  return (
    <PageContainer>
      <PageHeader
        title={rfq.title}
        description={rfq.description ?? `RFQ #${rfq.id}`}
        backHref="/rfqs"
      />

      <RFQExecutivePanel
        status={rfq.status}
        awardedVendorName={
          rfq.awardedVendor?.name
        }
        savingsAmount={
          rfq.savings?.savings
        }
        purchaseOrder={rfq.purchaseOrder}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetaCard
          label="Category"
          value={rfq.category?.name ?? "—"}
        />
        <MetaCard
          label="Created By"
          value={rfq.createdBy?.name ?? "—"}
        />
        <MetaCard
          label="Created"
          value={new Date(
            rfq.createdAt
          ).toLocaleDateString()}
        />
      </div>

      {rfq.savings && (
        <section className="mb-8 rounded-2xl border-2 border-green-300 bg-green-50 p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold text-green-900">
            Sourcing Savings
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <SavingsStat
              label="Highest Bid"
              value={formatINRCompact(
                rfq.savings.highestBid
              )}
            />
            <SavingsStat
              label="Winning Bid"
              value={formatINRCompact(
                rfq.savings.winningBid
              )}
            />
            <SavingsStat
              label="Savings"
              value={formatINR(
                rfq.savings.savings
              )}
              highlight
            />
          </div>
          <p className="mt-4 text-sm text-green-800">
            Awarded to{" "}
            <span className="font-semibold">
              {rfq.savings.vendor?.name ??
                rfq.awardedVendor?.name}
            </span>
          </p>
        </section>
      )}

      {recommendation &&
        rfq.status !== "AWARDED" && (
          <section className="mb-8 rounded-2xl border-2 border-blue-200 bg-blue-50 p-8 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-blue-900">
              Recommended Vendor
            </h2>
            <p className="text-3xl font-bold text-blue-950">
              {
                recommendation.recommendedVendor
              }
            </p>
            <p className="mt-3 text-blue-800">
              <span className="font-medium">
                Reason:
              </span>{" "}
              {recommendation.reason}
            </p>
            <p className="mt-2 text-sm text-blue-700">
              Score:{" "}
              <span className="font-semibold">
                {recommendation.score.toFixed(
                  1
                )}
              </span>
            </p>
          </section>
        )}

      <section className="mb-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold">
            Vendor Comparison
          </h2>
        </div>

        {bids.length === 0 ? (
          <p className="p-8 text-center text-gray-400">
            No bids yet. Submit vendor bids
            below.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500">
                <th className="p-4 font-semibold">
                  Vendor
                </th>
                <th className="p-4 font-semibold">
                  Bid
                </th>
                <th className="p-4 font-semibold">
                  Delivery
                </th>
                <th className="p-4 font-semibold">
                  Warranty
                </th>
                <th className="p-4 font-semibold">
                  Score
                </th>
                {isOpen && (
                  <th className="p-4 font-semibold">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => {
                const isRecommended =
                  bid.vendorId ===
                  recommendedVendorId;
                const isWinner =
                  bid.vendorId ===
                  rfq.awardedVendor?.id;

                return (
                  <tr
                    key={bid.id}
                    className={`border-t ${
                      isWinner
                        ? "bg-green-50"
                        : isRecommended
                          ? "bg-blue-50"
                          : ""
                    }`}
                  >
                    <td className="p-4">
                      <Link
                        href={`/vendors/${bid.vendor.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {formatText(
                          bid.vendor.name
                        )}
                      </Link>
                      {isWinner && (
                        <span className="ml-2 rounded-full bg-green-200 px-2 py-0.5 text-xs font-medium text-green-900">
                          Winner
                        </span>
                      )}
                      {isRecommended &&
                        !isWinner && (
                          <span className="ml-2 rounded-full bg-blue-200 px-2 py-0.5 text-xs font-medium text-blue-900">
                            Recommended
                          </span>
                        )}
                    </td>
                    <td className="p-4 font-medium">
                      {formatINRCompact(
                        bid.quotedAmount
                      )}
                    </td>
                    <td className="p-4">
                      {bid.leadTimeDays} days
                    </td>
                    <td className="p-4">
                      {bid.warrantyMonths}{" "}
                      months
                    </td>
                    <td className="p-4">
                      {bid.score > 0 ? (
                        <span className="font-semibold">
                          {bid.score.toFixed(
                            1
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">
                          —
                        </span>
                      )}
                    </td>
                    {isOpen && (
                      <td className="p-4">
                        <RFQAwardButton
                          rfqId={rfqId}
                          vendorId={
                            bid.vendorId
                          }
                          vendorName={
                            bid.vendor.name
                          }
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <RFQBidForm
          rfqId={rfqId}
          vendors={vendors}
          disabled={!canAcceptBids}
        />

        <RFQProcurementSection
          rfqId={rfqId}
          status={rfq.status}
          recommendedVendorId={
            recommendedVendorId
          }
          bidCount={bids.length}
          hasScores={hasScores}
          hasPO={!!rfq.purchaseOrder}
          user={user}
        />
      </div>
    </PageContainer>
  );
}

function MetaCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">
        {label}
      </p>
      <p className="mt-1 font-semibold">
        {value}
      </p>
    </div>
  );
}

function SavingsStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-green-800">
        {label}
      </p>
      <p
        className={`mt-1 ${
          highlight
            ? "text-4xl font-bold text-green-900"
            : "text-2xl font-semibold text-green-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
