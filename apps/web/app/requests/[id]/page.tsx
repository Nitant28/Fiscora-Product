/**
 * Purchase Request Detail
 * Purpose: Request workflow — approve, reject, RFQ/PO generation, split-purchase alerts.
 * Data: GET /purchase-requests/:id, GET /approvals (apiFetch).
 * Roles: request.view; request.approve for actions.
 */
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";
import GeneratePOButton from "../../../components/GeneratePOButton";
import RequestActions from "../../../components/RequestActions";
import SplitPurchaseAlert from "../../../components/SplitPurchaseAlert";
import { apiFetch, getCurrentUser } from "../../../lib/api";
import { formatMoney } from "../../../lib/metrics";

async function getRequest(id: string) {
  const res = await apiFetch(
    `/purchase-requests/${id}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch request");
  }
  return res.json();
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, inboxRes, user] = await Promise.all([
    getRequest(id),
    apiFetch("/approvals"),
    getCurrentUser(),
  ]);
  const request = data.request;
  const splitPurchaseRisk =
    data.splitPurchaseRisk ?? null;
  const inbox = inboxRes.ok
    ? await inboxRes.json()
    : { requests: [] };
  const canAct = (inbox.requests ?? []).some(
    (r: { id: number }) => r.id === request.id
  );

  const showActions =
    request.status === "SUBMITTED" && canAct;

  const showGeneratePO =
    request.status === "APPROVED" ||
    request.status === "CONVERTED_TO_PO";

  const existingPo =
    request.purchaseOrders?.[0];

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={request.title}
        description={`Request #${request.id}`}
        backHref="/requests"
        badge={<StatusBadge status={request.status} />}
      />

      {splitPurchaseRisk && (
        <SplitPurchaseAlert
          risk={splitPurchaseRisk}
        />
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm text-gray-500">
            Vendor
          </p>
          <p className="mt-1 font-semibold">
            {request.vendorName ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">
            Estimated Cost
          </p>
          <p className="mt-1 font-semibold">
            {formatMoney(
              request.estimatedAmount
            )}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">
            Requester
          </p>
          <p className="mt-1 font-semibold">
            {request.requester}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">
            Created
          </p>
          <p className="mt-1 font-semibold">
            {new Date(
              request.createdAt
            ).toLocaleDateString()}
          </p>
        </div>
      </div>

      {request.description && (
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-500">
            Reason
          </h2>
          <p className="text-gray-800">
            {request.description}
          </p>
        </div>
      )}

      {(request.status === "APPROVED" ||
        request.status === "REJECTED") && (
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-gray-500">
            Decision
          </h2>
          <p className="font-semibold">
            {request.status === "APPROVED"
              ? "Approved"
              : "Rejected"}{" "}
            by {request.approvedBy ?? "Manager"}
          </p>
          {request.approvedAt && (
            <p className="mt-1 text-sm text-gray-500">
              {new Date(
                request.approvedAt
              ).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {showGeneratePO && (
        <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Next Step
          </h2>
          <GeneratePOButton
            requestId={request.id}
            existingPoId={existingPo?.id}
          />
        </div>
      )}

      {showActions && (
        <div className="mt-8">
          <RequestActions
            requestId={request.id}
            user={user}
          />
        </div>
      )}
    </PageContainer>
  );
}
