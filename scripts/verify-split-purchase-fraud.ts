/**
 * =============================================================================
 * SCRIPT: verify-split-purchase-fraud.ts
 * LOCATION: scripts/
 * PURPOSE: Acceptance test for split-purchase fraud — detecting multiple
 *          requests just under the manager approval limit.
 *
 * WHAT IT DOES (4 phases):
 *   1. Remove prior SPLIT-DEMO-* purchase requests and flags
 *   2. Create three SUBMITTED requests (₹49k, ₹48k, ₹47k) same requester
 *   3. Evaluate split-purchase cluster on the last request
 *   4. Assert cluster, limit breach, audit log, alert count; exit 1 on fail
 *
 * RUN: npx tsx scripts/verify-split-purchase-fraud.ts
 * =============================================================================
 */

import prisma from "../apps/api/src/db";
import {
  evaluateSplitPurchaseOnCreate,
  getSplitPurchaseAlertCount,
  MANAGER_LIMIT,
} from "../apps/api/src/services/splitPurchaseFraud";

const PREFIX = "SPLIT-DEMO-";

/* --- Cleanup: remove demo purchase requests and flags --- */
async function cleanup() {
  const requests =
    await prisma.purchaseRequest.findMany({
      where: {
        title: { startsWith: PREFIX },
      },
      select: { id: true },
    });

  const ids = requests.map((request) => request.id);

  if (ids.length === 0) return;

  await prisma.purchaseRequestFlag.deleteMany({
    where: { requestId: { in: ids } },
  });
  await prisma.purchaseRequest.deleteMany({
    where: { id: { in: ids } },
  });
}

async function main() {
  /* =========================================================================
   * PHASE 1: Reset demo split-purchase data
   * ========================================================================= */
  await cleanup();

  const category =
    await prisma.spendCategory.findFirst({
      where: { active: true },
    });

  const department =
    await prisma.department.findFirst();

  if (!category || !department) {
    throw new Error(
      "Need at least one spend category and department"
    );
  }

  /* =========================================================================
   * PHASE 2: Seed three requests each just under typical approval threshold
   * Combined ₹144k exceeds MANAGER_LIMIT when evaluated as a cluster
   * ========================================================================= */
  const amounts = [49000, 48000, 47000];
  const created = [];

  for (const amount of amounts) {
    const request =
      await prisma.purchaseRequest.create({
        data: {
          title: `${PREFIX}Laptop Accessories`,
          vendorName: "Dell",
          estimatedAmount: amount,
          category: category.name,
          categoryId: category.id,
          requester: "Alex Employee",
          departmentId: department.id,
          status: "SUBMITTED",
        },
      });

    created.push(request);
  }

  const lastRequest = created[created.length - 1]!;

  /* =========================================================================
   * PHASE 3: Run split-purchase evaluation on the triggering request
   * ========================================================================= */
  const cluster = await evaluateSplitPurchaseOnCreate(
    lastRequest,
    "Alex Employee"
  );

  const alertCount =
    await getSplitPurchaseAlertCount();

  const audit = await prisma.auditLog.findFirst({
    where: {
      entityType: "PurchaseRequest",
      entityId: lastRequest.id,
      action: "SPLIT_PURCHASE_DETECTED",
    },
  });

  /* =========================================================================
   * PHASE 4: Acceptance checks
   * ========================================================================= */
  const checks = [
    {
      label: "Cluster detected",
      pass:
        cluster?.requestCount === 3 &&
        cluster.combinedSpend === 144000,
    },
    {
      label: "Combined spend exceeds manager limit",
      pass:
        (cluster?.combinedSpend ?? 0) >
        MANAGER_LIMIT,
    },
    {
      label: "Audit log recorded",
      pass: audit != null,
    },
    {
      label: "Risk alert count updated",
      pass: alertCount >= 3,
    },
  ];

  console.log("Split purchase fraud checks:");
  for (const check of checks) {
    console.log(
      `${check.pass ? "PASS" : "FAIL"} — ${check.label}`
    );
  }

  if (!checks.every((check) => check.pass)) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
