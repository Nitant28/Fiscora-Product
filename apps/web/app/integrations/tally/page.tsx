/**
 * Tally Export Center — CSV registers for Indian accounting import.
 */
import { redirect } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import TallyExportPanel from "../../../components/integrations/TallyExportPanel";
import { getCurrentUser } from "../../../lib/api";
import { getTallyExportSummary } from "../../../lib/tally";
import { hasPermission, PERMISSION_KEYS } from "../../../lib/permissions";

export default async function TallyExportPage() {
  const user = await getCurrentUser();

  if (
    !user ||
    !hasPermission(user, PERMISSION_KEYS.TALLY_EXPORT)
  ) {
    redirect("/dashboard");
  }

  const summary = await getTallyExportSummary().catch(() => ({
    vendors: 0,
    purchaseOrders: 0,
    invoices: 0,
    payments: 0,
    formats: ["CSV"],
    note: "",
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Tally Export Center"
        description="Governed CSV exports for Tally import — verified vendors, GST breakdown, payment references, and export audit history."
      />

      <TallyExportPanel summary={summary} />
    </PageContainer>
  );
}
