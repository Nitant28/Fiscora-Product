import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";
import ContractMetricCard from "../../../components/contracts/ContractMetricCard";
import ContractRiskTable from "../../../components/contracts/ContractRiskTable";
import RenewalCalendar from "../../../components/contracts/RenewalCalendar";
import { getCurrentUser } from "../../../lib/api";
import { canManageContracts } from "../../../lib/auth";
import { getContractIntelligence } from "../../../lib/contracts-intelligence";
import { formatINR } from "../../../lib/metrics";

export default async function ContractIntelligencePage() {
  const [data, user] = await Promise.all([
    getContractIntelligence().catch(() => null),
    getCurrentUser(),
  ]);

  const canManage = canManageContracts(user);

  if (!data?.summary) {
    return (
      <PageContainer>
        <PageHeader title="Contract Intelligence" />
        <div className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          Unable to load contract intelligence. Ensure the API is running.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Contract Action Center"
        description="Insights plus recommended actions — renewals, utilization, concentration risk, and one-click procurement workflows."
        actions={
          <>
            <Link href="/executive/recommendations">
              <Button variant="secondary">Executive recommendations</Button>
            </Link>
            <Link href="/contracts">
              <Button variant="outline">View all contracts</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ContractMetricCard
          label="Expiring Soon"
          value={data.summary.expiringSoon}
          subtitle="Within 30 days"
          variant="red"
        />
        <ContractMetricCard
          label="Auto Renewals"
          value={data.summary.autoRenewals}
          subtitle="Next 90 days"
          variant="amber"
        />
        <ContractMetricCard
          label="Underutilized"
          value={data.summary.underutilized}
          subtitle="Below 25% spend"
          variant="amber"
        />
        <ContractMetricCard
          label="Overutilized"
          value={data.summary.overutilized}
          subtitle="Above 90% spend"
          variant="red"
        />
        <ContractMetricCard
          label="High Value"
          displayText={formatINR(data.summary.highValueTotal)}
          subtitle={`${data.summary.activeContracts} active contracts`}
          variant="default"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ContractRiskTable
          title="Expiring contracts"
          description="Contracts approaching end date — take renewal action before expiry."
          columns={[
            "Contract",
            "Vendor",
            "Expiry",
            "Days",
            "Value",
            "Status",
          ]}
          actionContext="expiring"
          canManage={canManage}
          rows={data.expiring.map((row) => ({
            id: row.id,
            cells: [
              row.title,
              row.vendorName,
              new Date(row.endDate).toLocaleDateString(),
              String(row.daysRemaining),
              formatINR(row.contractValue),
              row.autoRenew ? "Auto renew" : "Manual renew",
            ],
            urgency: row.urgency,
          }))}
        />

        <ContractRiskTable
          title="Auto-renewal risk"
          description="Contracts that may renew without explicit approval."
          columns={[
            "Contract",
            "Vendor",
            "Notice",
            "Days",
            "Value",
          ]}
          actionContext="auto-renewal"
          canManage={canManage}
          rows={data.autoRenewals.map((row) => ({
            id: row.id,
            cells: [
              row.title,
              row.vendorName,
              `${row.renewalNoticeDays} days`,
              String(row.daysRemaining),
              formatINR(row.contractValue),
            ],
            urgency: row.urgency,
          }))}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ContractRiskTable
          title="Underutilized contracts"
          description="Low drawdown on committed spend — review or reduce commitment."
          columns={[
            "Contract",
            "Value",
            "Spend",
            "Util %",
            "Remaining",
          ]}
          actionContext="underutilized"
          canManage={canManage}
          rows={data.underutilized.map((row) => ({
            id: row.id,
            cells: [
              row.title,
              formatINR(row.contractValue),
              formatINR(row.spend),
              `${row.utilizationPercent}%`,
              formatINR(row.remaining),
            ],
            urgency:
              row.utilizationPercent < 10
                ? "critical"
                : "warning",
          }))}
        />

        <ContractRiskTable
          title="Contract concentration"
          description="Vendor dependency across active contract portfolio."
          columns={["Vendor", "Spend", "Share", "Risk"]}
          actionContext="concentration"
          canManage={canManage}
          rows={data.concentration.map((row) => ({
            id: row.vendorId,
            vendorId: row.vendorId,
            cells: [
              row.vendorName,
              formatINR(row.spend),
              `${row.spendPercent}%`,
              row.highDependency
                ? "High dependency"
                : "Balanced",
            ],
            urgency: row.highDependency
              ? "critical"
              : "healthy",
          }))}
        />
      </div>

      <div className="mt-8">
        <RenewalCalendar months={data.calendar} />
      </div>
    </PageContainer>
  );
}
