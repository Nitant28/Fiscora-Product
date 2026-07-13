/**
 * Vendor Risk Profile — compliance investigation detail.
 */
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { StatusBadge } from "@repo/ui/status-badge";
import { getCurrentUser } from "../../../../lib/api";
import { getVendorComplianceProfile } from "../../../../lib/compliance";
import { hasPermission, PERMISSION_KEYS } from "../../../../lib/permissions";

export default async function VendorComplianceProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const vendorId = Number(id);

  if (
    !user ||
    !hasPermission(user, PERMISSION_KEYS.COMPLIANCE_VIEW)
  ) {
    redirect("/dashboard");
  }

  if (!Number.isFinite(vendorId)) {
    notFound();
  }

  const profile = await getVendorComplianceProfile(
    vendorId
  ).catch(() => null);

  if (!profile) {
    notFound();
  }

  return (
    <PageContainer>
      <PageHeader
        title={profile.vendor.name}
        description="Vendor Risk Profile"
        backHref="/compliance"
        actions={
          <div className="rounded-xl border border-border bg-surface px-6 py-4 text-right shadow-card">
            <p className="text-sm text-muted">Risk Score</p>
            <p className="text-4xl font-bold text-danger-fg financial-figure">
              {profile.compliance.riskScore}
            </p>
            <StatusBadge status={profile.compliance.riskLevel} />
          </div>
        }
      />

      <section className="mt-8 rounded-2xl border border-red-100 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">
          Why this score?
        </h2>
        {profile.compliance.reasons.length === 0 ? (
          <p className="mt-2 text-sm text-red-800">
            No compliance risk factors detected
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {profile.compliance.reasons.map((reason) => (
              <li
                key={reason.code}
                className="flex items-center justify-between rounded-lg bg-white px-4 py-2 text-sm"
              >
                <span>{reason.label}</span>
                <span className="font-semibold text-red-700">
                  +{reason.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Vendor & KYC
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Status" value={profile.vendor.status} />
            <Row label="KYC" value={profile.vendor.kycStatus} />
            <Row label="GST" value={profile.vendor.gstNumber} />
            <Row label="GST Status" value={profile.compliance.gstStatus} />
            <Row label="PAN" value={profile.vendor.panNumber} />
            <Row label="MSME" value={profile.vendor.msmeNumber} />
          </dl>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            GST Validation
          </h2>
          {!profile.gst ? (
            <p className="text-sm text-gray-500">
              No GST validation on record
            </p>
          ) : (
            <dl className="space-y-2 text-sm">
              <Row
                label="Valid"
                value={profile.gst.isValid ? "Yes" : "No"}
              />
              <Row label="State" value={profile.gst.stateCode} />
              <Row label="PAN derived" value={profile.gst.panDerived} />
              <Row
                label="Last checked"
                value={new Date(
                  profile.gst.lastCheckedAt
                ).toLocaleString()}
              />
            </dl>
          )}
        </section>
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Documents</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                File
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Expiry
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {profile.documents.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-6 text-center text-gray-500"
                >
                  No documents uploaded
                </td>
              </tr>
            ) : (
              profile.documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-6 py-3">{doc.type}</td>
                  <td className="px-6 py-3">{doc.fileName}</td>
                  <td className="px-6 py-3">
                    <StatusBadge
                      status={doc.verificationStatus}
                    />
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {doc.expiryDate
                      ? new Date(
                          doc.expiryDate
                        ).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Recent Violations
          </h2>
          {profile.recentViolations.length === 0 ? (
            <p className="text-sm text-gray-500">None recorded</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {profile.recentViolations.map((v) => (
                <li
                  key={`${v.type}-${v.id}`}
                  className="rounded-lg border px-3 py-2"
                >
                  <p className="font-medium">{v.action}</p>
                  <p className="text-gray-500">
                    {v.actor} ·{" "}
                    {new Date(v.createdAt).toLocaleString()}
                  </p>
                  {v.requestId && (
                    <p className="font-mono text-xs text-gray-400">
                      Request: {v.requestId}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Payments & Contracts
          </h2>
          <h3 className="text-sm font-medium text-gray-700">
            Payments
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {profile.payments.slice(0, 5).map((p) => (
              <li key={p.id}>
                ₹{p.amount.toLocaleString()} · {p.status}
                {p.isLate && (
                  <span className="ml-2 text-red-600">
                    (late)
                  </span>
                )}
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-medium text-gray-700">
            Contracts
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {profile.contracts.map((c) => (
              <li key={c.id}>
                {c.contractNumber} · expires{" "}
                {new Date(c.endDate).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}
