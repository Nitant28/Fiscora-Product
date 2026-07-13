import { runWithTenantId } from "../src/lib/tenantContext";
import { getProcurementIntelligenceDashboard } from "../src/services/procurementIntelligence";

async function main() {
  await runWithTenantId(1, async () => {
    const data = await getProcurementIntelligenceDashboard();
    console.log("Sprint 16 OK");
    console.log("  totalSpend:", data.spend.totalSpend);
    console.log("  cycleDays:", data.cycleTime.averageProcurementCycleDays);
    console.log("  maverick:", data.maverick.maverickSpend);
    console.log("  budgetAlerts:", data.budget.atRisk);
    console.log("  vendors:", data.vendors.length);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
