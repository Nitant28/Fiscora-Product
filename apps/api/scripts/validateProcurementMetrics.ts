/**
 * Phase 16.5 — Validates procurement metrics against SQL ground truth.
 * Run: pnpm --filter api exec tsx scripts/validateProcurementMetrics.ts
 */
import { runWithTenantId } from "../src/lib/tenantContext";
import { getSpendAnalytics } from "../src/services/spendAnalytics";
import { getProcurementCycleTime } from "../src/services/cycleTime";
import { getMaverickSpend } from "../src/services/maverickSpend";
import prisma, { prismaRaw } from "../src/db";

async function sqlTotalSpend() {
  const [row] = await prismaRaw.$queryRaw<[{ total: number }]>`
    SELECT COALESCE(SUM("totalAmount"), 0)::float AS total
    FROM "Document"
    WHERE "deletedAt" IS NULL
      AND status IN ('approved', 'paid')
      AND "totalAmount" IS NOT NULL
  `;
  return Math.round(Number(row?.total ?? 0));
}

async function sqlMonthlySpend() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [row] = await prismaRaw.$queryRaw<[{ total: number }]>`
    SELECT COALESCE(SUM("totalAmount"), 0)::float AS total
    FROM "Document"
    WHERE "deletedAt" IS NULL
      AND status IN ('approved', 'paid')
      AND "totalAmount" IS NOT NULL
      AND "createdAt" >= ${monthStart}
  `;
  return Math.round(Number(row?.total ?? 0));
}

async function sqlAvgInvoice() {
  const [row] = await prismaRaw.$queryRaw<
    [{ avg: number | null; cnt: bigint }]
  >`
    SELECT AVG("totalAmount")::float AS avg, COUNT(*)::bigint AS cnt
    FROM "Document"
    WHERE "deletedAt" IS NULL
      AND status IN ('approved', 'paid')
      AND "totalAmount" IS NOT NULL
  `;
  const cnt = Number(row?.cnt ?? 0);
  return {
    avg: cnt > 0 ? Math.round(Number(row?.avg ?? 0)) : null,
    cnt,
  };
}

async function sqlAvgPo() {
  const [row] = await prismaRaw.$queryRaw<
    [{ avg: number | null; cnt: bigint }]
  >`
    SELECT AVG(amount)::float AS avg, COUNT(*)::bigint AS cnt
    FROM "PurchaseOrder"
    WHERE "deletedAt" IS NULL AND amount > 0
  `;
  const cnt = Number(row?.cnt ?? 0);
  return {
    avg: cnt > 0 ? Math.round(Number(row?.avg ?? 0)) : null,
    cnt,
  };
}

function assertEqual(name: string, expected: number | null, actual: number | null) {
  if (expected === actual) {
    console.log(`PASS ${name}: ${actual}`);
    return true;
  }
  console.error(`FAIL ${name}: SQL=${expected} API=${actual}`);
  return false;
}

async function main() {
  let passed = 0;
  let failed = 0;

  await runWithTenantId(1, async () => {
    const spend = await getSpendAnalytics();
    const cycle = await getProcurementCycleTime();
    const maverick = await getMaverickSpend();

    const checks = [
      assertEqual("totalSpend", await sqlTotalSpend(), spend.totalSpend),
      assertEqual("monthlySpend", await sqlMonthlySpend(), spend.monthlySpend),
    ];

    const sqlInv = await sqlAvgInvoice();
    checks.push(
      assertEqual("averageInvoice", sqlInv.avg, spend.averageInvoice)
    );

    const sqlPo = await sqlAvgPo();
    checks.push(assertEqual("averagePO", sqlPo.avg, spend.averagePO));

    passed += checks.filter(Boolean).length;
    failed += checks.filter((c) => !c).length;

    if (
      cycle.averageProcurementCycleDays === null ||
      Number.isFinite(cycle.averageProcurementCycleDays)
    ) {
      console.log(
        `PASS cycleTime: ${cycle.averageProcurementCycleLabel} (${cycle.completeChainCount} complete chains)`
      );
      passed++;
    } else {
      console.error("FAIL cycleTime: invalid average", cycle.averageProcurementCycleDays);
      failed++;
    }

    if (
      maverick.maverickPercent === null ||
      (maverick.maverickPercent >= 0 && maverick.maverickPercent <= 100)
    ) {
      console.log(
        `PASS maverick: ${maverick.maverickSpend} (${maverick.maverickPercent ?? "N/A"}%)`
      );
      passed++;
    } else {
      console.error("FAIL maverick percent:", maverick.maverickPercent);
      failed++;
    }

    const vendorSum = spend.spendByVendor.reduce((s, v) => s + v.spend, 0);
    if (vendorSum <= spend.totalSpend) {
      console.log(`PASS vendorSpend: top-10 sum ${vendorSum} <= total ${spend.totalSpend}`);
      passed++;
    } else {
      console.error("FAIL vendorSpend exceeds total");
      failed++;
    }
  });

  await prisma.$disconnect();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("Phase 16.5 validation complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
