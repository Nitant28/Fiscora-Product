/**
 * Acceptance checks for Sprint 7.2 approval matrix decisions.
 *
 * RUN: npx tsx scripts/verify-approval-matrix.ts
 */
import prisma from "../apps/api/src/db";
import { determineApprover } from "../apps/api/src/services/approvalMatrix";

const VERIFY_RULE_NAMES = [
  "VERIFY Manager approval",
  "VERIFY Director approval",
  "VERIFY CFO approval",
  "VERIFY IT override",
];

async function seedVerificationRules() {
  await prisma.approvalRule.deleteMany({
    where: { name: { in: VERIFY_RULE_NAMES } },
  });

  await prisma.approvalRule.createMany({
    data: [
      {
        name: "VERIFY IT override",
        department: "IT",
        minAmount: 0,
        maxAmount: 50000,
        approver: "Director",
        priority: 1000,
      },
      {
        name: "VERIFY Manager approval",
        minAmount: 0,
        maxAmount: 50000,
        approver: "Manager",
        priority: 900,
      },
      {
        name: "VERIFY Director approval",
        minAmount: 50000,
        maxAmount: 500000,
        approver: "Director",
        priority: 900,
      },
      {
        name: "VERIFY CFO approval",
        minAmount: 500000,
        approver: "CFO",
        priority: 900,
      },
    ],
  });
}

async function cleanupVerificationRules() {
  await prisma.approvalRule.deleteMany({
    where: { name: { in: VERIFY_RULE_NAMES } },
  });
}

async function main() {
  await seedVerificationRules();

  const cases = [
    {
      label: "20k routes to manager",
      decision: await determineApprover(20000),
      expected: "MANAGER",
    },
    {
      label: "2L routes to director",
      decision: await determineApprover(200000),
      expected: "DIRECTOR",
    },
    {
      label: "10L routes to CFO",
      decision: await determineApprover(1000000),
      expected: "CFO",
    },
    {
      label: "IT override routes 30k to director",
      decision: await determineApprover(
        30000,
        "IT"
      ),
      expected: "DIRECTOR",
    },
  ];

  let failed = 0;

  for (const test of cases) {
    const pass = test.decision.role === test.expected;
    const status = pass ? "PASS" : "FAIL";
    if (!pass) failed += 1;

    console.log(
      `[${status}] ${test.label}\n       actual: ${JSON.stringify(test.decision)}\n       expected role: ${test.expected}`
    );
  }

  if (failed > 0) {
    throw new Error(
      `${failed} approval matrix check(s) failed`
    );
  }

  await cleanupVerificationRules();

  console.log(
    "\nAll approval matrix verification checks passed."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
