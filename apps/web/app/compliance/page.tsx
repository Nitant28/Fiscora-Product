/**
 * Compliance Center — GST intelligence and vendor risk dashboard.
 */
import { redirect } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import ComplianceDashboard from "../../components/compliance/ComplianceDashboard";
import { getCurrentUser } from "../../lib/api";
import {
  getComplianceRisks,
  getComplianceVendors,
} from "../../lib/compliance";
import { hasPermission, PERMISSION_KEYS } from "../../lib/permissions";

export default async function CompliancePage() {
  const user = await getCurrentUser();

  if (
    !user ||
    !hasPermission(user, PERMISSION_KEYS.COMPLIANCE_VIEW)
  ) {
    redirect("/dashboard");
  }

  const [vendorsData, risks] = await Promise.all([
    getComplianceVendors().catch(() => ({
      vendors: [],
      summary: {
        highRiskVendors: 0,
        gstIssues: 0,
        missingPan: 0,
        pendingKyc: 0,
        expiringDocuments: 0,
      },
      drillDown: {
        gstIssues: [],
        highRiskVendors: [],
        missingPan: [],
        pendingKyc: [],
        expiringDocuments: [],
      },
    })),
    getComplianceRisks().catch(() => null),
  ]);

  const { vendors, summary, drillDown } = vendorsData;

  return (
    <PageContainer rhythm>
      <PageHeader
        title="Compliance Center"
        description="GST intelligence, explainable vendor risk, and compliance investigations — click any card to drill down"
      />

      {risks?.formula && (
        <section className="rounded-xl border border-border bg-surface-subtle p-6">
          <h2 className="mb-3 text-md font-semibold text-foreground">
            Risk Formula
          </h2>
          <div className="grid gap-2 text-sm text-foreground-subtle sm:grid-cols-2 lg:grid-cols-3">
            <p>Missing GST: +{risks.formula.missingGst}</p>
            <p>Missing PAN: +{risks.formula.missingPan}</p>
            <p>KYC Pending: +{risks.formula.kycPending}</p>
            <p>Inactive Vendor: +{risks.formula.inactiveVendor}</p>
            <p>Expired Document: +{risks.formula.expiredDocument}</p>
            <p>Late Payments: +{risks.formula.latePayments}</p>
          </div>
          <p className="mt-3 text-sm text-muted">
            LOW {risks.formula.bands.low} · MEDIUM {risks.formula.bands.medium} ·
            HIGH {risks.formula.bands.high}
          </p>
        </section>
      )}

      <ComplianceDashboard
        summary={summary}
        drillDown={drillDown}
        vendors={vendors}
      />
    </PageContainer>
  );
}
