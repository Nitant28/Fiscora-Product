/**
 * Smoke test: Billing Foundation (Sprint 19).
 *   pnpm --filter api exec tsx scripts/testBilling.ts
 */
import { setTenantId } from "../src/lib/tenantContext";
import {
  seedBillingCatalog,
  ensureTenantSubscription,
  listPlans,
  getSubscriptionSummary,
  isFeatureEnabled,
  changePlan,
  BILLING_FEATURES,
} from "../src/services/billing.service";

setTenantId(1);

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
  }
}

async function main() {
  console.log("\n── Billing Foundation ──\n");

  await seedBillingCatalog();
  const plans = await listPlans();
  check("3 plans seeded", plans.length === 3);
  check("starter plan exists", plans.some((p) => p.slug === "starter"));

  const sub = await ensureTenantSubscription(1);
  check("tenant has subscription", Boolean(sub.id));
  check("default trial status", sub.status === "TRIAL");

  const summary = await getSubscriptionSummary(1);
  check("summary has usage", summary.usage.seatsUsed >= 0);
  check("starter features include core", summary.features.includes("core_procurement"));

  const vendorPortalStarter = await isFeatureEnabled(
    1,
    BILLING_FEATURES.VENDOR_PORTAL
  );
  check("starter: vendor_portal disabled", !vendorPortalStarter);

  await changePlan(1, "growth", { id: 1, name: "Test Admin" });
  const growthPortal = await isFeatureEnabled(
    1,
    BILLING_FEATURES.VENDOR_PORTAL
  );
  check("growth: vendor_portal enabled", growthPortal);

  await changePlan(1, "starter", { id: 1, name: "Test Admin" });

  console.log(`\n── Result: ${passed} passed, ${failed} failed ──\n`);
  if (failed) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prismaRaw } = await import("../src/db");
    await prismaRaw.$disconnect();
  });
