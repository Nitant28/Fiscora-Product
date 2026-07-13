import { getContractIntelligenceDashboard } from "../src/services/contractIntelligence";
import { enrichContractIntelligenceMetadata } from "../src/services/contractIntelligenceSeed";

async function main() {
  await enrichContractIntelligenceMetadata().catch((err) => {
    console.error("enrich failed:", err.message);
  });

  const dashboard = await getContractIntelligenceDashboard();
  console.log(
    JSON.stringify(
      {
        success: true,
        summary: dashboard.summary,
        expiringCount: dashboard.expiring.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error("FAILED:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
