"use client";

import Link from "next/link";
import { useState } from "react";
import AuditMetricCard from "../audit/AuditMetricCard";
import StatusBadge from "../StatusBadge";
import type {
  ComplianceDrillDown,
  ComplianceSummary,
  ComplianceVendorRow,
  GstIssueRow,
} from "../../lib/compliance";

type Panel =
  | "highRisk"
  | "gstIssues"
  | "missingPan"
  | "pendingKyc"
  | "expiringDocuments"
  | null;

type Props = {
  summary: ComplianceSummary;
  drillDown: ComplianceDrillDown;
  vendors: ComplianceVendorRow[];
};

export default function ComplianceDashboard({
  summary,
  drillDown,
  vendors,
}: Props) {
  const [panel, setPanel] = useState<Panel>(null);

  function toggle(next: Panel) {
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => toggle("highRisk")}
          className={`text-left transition ring-offset-2 focus:outline-none focus:ring-2 focus:ring-rose-400 rounded-2xl ${
            panel === "highRisk" ? "ring-2 ring-rose-400" : ""
          }`}
        >
          <AuditMetricCard
            label="High Risk Vendors"
            value={summary.highRiskVendors}
            variant="red"
            subtitle="Click to investigate"
          />
        </button>
        <button
          type="button"
          onClick={() => toggle("gstIssues")}
          className={`text-left transition ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-2xl ${
            panel === "gstIssues" ? "ring-2 ring-amber-400" : ""
          }`}
        >
          <AuditMetricCard
            label="GST Issues"
            value={summary.gstIssues}
            variant="amber"
            subtitle="Click to investigate"
          />
        </button>
        <button
          type="button"
          onClick={() => toggle("missingPan")}
          className={`text-left transition ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-2xl ${
            panel === "missingPan" ? "ring-2 ring-amber-400" : ""
          }`}
        >
          <AuditMetricCard
            label="Missing PAN"
            value={summary.missingPan}
            variant="amber"
            subtitle="Click to investigate"
          />
        </button>
        <button
          type="button"
          onClick={() => toggle("pendingKyc")}
          className={`text-left transition ring-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded-2xl ${
            panel === "pendingKyc" ? "ring-2 ring-indigo-400" : ""
          }`}
        >
          <AuditMetricCard
            label="Pending KYC"
            value={summary.pendingKyc}
            variant="indigo"
            subtitle="Click to investigate"
          />
        </button>
        <button
          type="button"
          onClick={() => toggle("expiringDocuments")}
          className={`text-left transition ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-2xl ${
            panel === "expiringDocuments"
              ? "ring-2 ring-amber-400"
              : ""
          }`}
        >
          <AuditMetricCard
            label="Expiring Documents"
            value={summary.expiringDocuments}
            variant="amber"
            subtitle="Click to investigate"
          />
        </button>
      </section>

      {panel === "gstIssues" && (
        <DrillDownSection title="GST Issues">
          <GstIssuesTable rows={drillDown.gstIssues} />
        </DrillDownSection>
      )}

      {panel === "highRisk" && (
        <DrillDownSection title="High Risk Vendors">
          <RiskVendorTable rows={drillDown.highRiskVendors} />
        </DrillDownSection>
      )}

      {panel === "missingPan" && (
        <DrillDownSection title="Missing PAN">
          <SimpleVendorTable
            rows={drillDown.missingPan}
            emptyMessage="All vendors have PAN on file"
          />
        </DrillDownSection>
      )}

      {panel === "pendingKyc" && (
        <DrillDownSection title="Pending KYC">
          <SimpleVendorTable
            rows={drillDown.pendingKyc}
            showKyc
            emptyMessage="No pending KYC reviews"
          />
        </DrillDownSection>
      )}

      {panel === "expiringDocuments" && (
        <DrillDownSection title="Expiring Documents (30 days)">
          <ExpiringDocsTable rows={drillDown.expiringDocuments} />
        </DrillDownSection>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold">
            Vendor Compliance
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  GST
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  PAN
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  KYC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Risk Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Why
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Level
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {vendors.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No vendor compliance data yet
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr key={vendor.vendorId}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/compliance/vendors/${vendor.vendorId}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {vendor.vendorName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <div>{vendor.gstNumber ?? "—"}</div>
                      <StatusBadge status={vendor.gstStatus} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {vendor.panNumber ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={vendor.kycStatus} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold">
                      {vendor.riskScore}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {vendor.reasons.length > 0
                        ? vendor.reasons
                            .map((r) => r.label)
                            .join(", ")
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={vendor.riskLevel} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DrillDownSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto p-2">{children}</div>
    </section>
  );
}

function GstIssuesTable({ rows }: { rows: GstIssueRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-gray-500">
        No GST issues detected
      </p>
    );
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Vendor
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            GSTIN
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Issue
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Detected At
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row) => (
          <tr key={`${row.vendorId}-${row.issue}`}>
            <td className="px-4 py-3">
              <Link
                href={`/compliance/vendors/${row.vendorId}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {row.vendorName}
              </Link>
            </td>
            <td className="px-4 py-3 font-mono text-sm">
              {row.gstin ?? "NULL"}
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={row.issue.replace(/\s+/g, "_").toUpperCase()} />
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">
              {new Date(row.detectedAt).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RiskVendorTable({
  rows,
}: {
  rows: ComplianceVendorRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-gray-500">
        No high-risk vendors
      </p>
    );
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Vendor
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Risk Score
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Risk Factors
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row) => (
          <tr key={row.vendorId}>
            <td className="px-4 py-3">
              <Link
                href={`/compliance/vendors/${row.vendorId}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {row.vendorName}
              </Link>
            </td>
            <td className="px-4 py-3 font-semibold">
              {row.riskScore}
            </td>
            <td className="px-4 py-3 text-sm text-gray-700">
              {row.reasons.map((r) => r.label).join(", ")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SimpleVendorTable({
  rows,
  showKyc,
  emptyMessage,
}: {
  rows: ComplianceVendorRow[];
  showKyc?: boolean;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-gray-500">{emptyMessage}</p>
    );
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Vendor
          </th>
          {showKyc && (
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              KYC
            </th>
          )}
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Risk Score
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row) => (
          <tr key={row.vendorId}>
            <td className="px-4 py-3">
              <Link
                href={`/compliance/vendors/${row.vendorId}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {row.vendorName}
              </Link>
            </td>
            {showKyc && (
              <td className="px-4 py-3">
                <StatusBadge status={row.kycStatus} />
              </td>
            )}
            <td className="px-4 py-3">{row.riskScore}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExpiringDocsTable({
  rows,
}: {
  rows: ComplianceDrillDown["expiringDocuments"];
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-gray-500">
        No documents expiring in the next 30 days
      </p>
    );
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Vendor
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Document
          </th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
            Expires
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row) => (
          <tr
            key={`${row.vendorId}-${row.fileName}`}
          >
            <td className="px-4 py-3">
              <Link
                href={`/compliance/vendors/${row.vendorId}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {row.vendorName}
              </Link>
            </td>
            <td className="px-4 py-3 text-sm">
              {row.documentType} — {row.fileName}
            </td>
            <td className="px-4 py-3 text-sm">
              {new Date(row.expiryDate).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
