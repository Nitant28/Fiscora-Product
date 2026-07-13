/**
 * Automated test: the Access Request → Provisioning lifecycle.
 *
 *   pnpm --filter api exec tsx scripts/testAccessLifecycle.ts
 *
 * Exercises the service layer end-to-end (no Clerk tokens needed):
 *   1. An unprovisioned identity submits an access request (PENDING).
 *   2. It appears in the admin queue with a correct pending count.
 *   3. An admin approves with a role → a Fiscora User is created (ACTIVE, role set).
 *   4. A second request can be rejected.
 *   5. Duplicate requests for the same email are collapsed.
 *
 * Prints a PASS/FAIL summary and cleans up everything it created.
 */
import { setTenantId } from "../src/lib/tenantContext";
import { prismaRaw } from "../src/db";
import {
  createAccessRequest,
  listAccessRequests,
  getAccessRequestCounts,
  approveAccessRequest,
  rejectAccessRequest,
} from "../src/services/accessRequest.service";

setTenantId(1);

let passed = 0;
let failed = 0;
const createdUserIds: number[] = [];
const createdRequestEmails: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const stamp = Date.now();
  const requesterEmail = `lifecycle.approve.${stamp}@example.com`;
  const rejectEmail = `lifecycle.reject.${stamp}@example.com`;
  createdRequestEmails.push(requesterEmail, rejectEmail);

  const admin = await prismaRaw.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { id: "asc" },
  });
  if (!admin) {
    console.error("No ADMIN user found. Seed the database first.");
    process.exit(1);
  }
  const actor = { id: admin.id, name: admin.name, role: admin.role };

  console.log("\n── Access Request Lifecycle ──\n");

  // 1. Create
  const created = await createAccessRequest({
    email: requesterEmail,
    name: "Lifecycle Tester",
    reason: "Automated test",
    requestedDepartment: "IT",
  });
  check("create returns ok", created.ok === true);
  const requestId =
    created.ok && created.request ? created.request.id : -1;
  check(
    "new request is PENDING",
    created.ok && created.request?.status === "PENDING"
  );

  // 2. Duplicate collapses
  const dup = await createAccessRequest({
    email: requesterEmail,
    name: "Lifecycle Tester",
  });
  check(
    "duplicate request is collapsed",
    dup.ok === true && dup.duplicate === true
  );

  // 3. Appears in admin queue + counts
  const pending = await listAccessRequests({ status: "PENDING" });
  check(
    "request appears in PENDING queue",
    pending.some((r) => r.id === requestId)
  );
  const counts = await getAccessRequestCounts();
  check("pending count is positive", counts.PENDING >= 1, `got ${counts.PENDING}`);

  // 4. Approve → user created, ACTIVE, correct role
  const approved = await approveAccessRequest(
    requestId,
    { role: "EMPLOYEE" },
    actor
  );
  check("approve created a user", Boolean(approved.user?.id));
  check("created user role is EMPLOYEE", approved.user?.role === "EMPLOYEE");
  check("created user is ACTIVE", approved.user?.status === "ACTIVE");
  check(
    "created user email matches request",
    approved.user?.email === requesterEmail
  );
  check(
    "request is now APPROVED",
    approved.request?.status === "APPROVED"
  );
  if (approved.user?.id) createdUserIds.push(approved.user.id);

  // 5. Approving again should fail (already processed)
  let reApproveBlocked = false;
  try {
    await approveAccessRequest(requestId, { role: "EMPLOYEE" }, actor);
  } catch {
    reApproveBlocked = true;
  }
  check("re-approving an approved request is blocked", reApproveBlocked);

  // 6. Reject path
  const toReject = await createAccessRequest({
    email: rejectEmail,
    name: "Reject Tester",
  });
  const rejectId =
    toReject.ok && toReject.request ? toReject.request.id : -1;
  const rejected = await rejectAccessRequest(
    rejectId,
    actor,
    "Not a valid request"
  );
  check(
    "reject sets status REJECTED",
    rejected.request?.status === "REJECTED"
  );
  check(
    "rejected request creates no user",
    !(await prismaRaw.user.findFirst({ where: { email: rejectEmail } }))
  );

  // --- Cleanup ---
  await prismaRaw.user.deleteMany({
    where: { id: { in: createdUserIds } },
  });
  await prismaRaw.accessRequest.deleteMany({
    where: { email: { in: createdRequestEmails } },
  });

  console.log(`\n── Result: ${passed} passed, ${failed} failed ──\n`);
  if (failed > 0) process.exit(1);
}

main()
  .catch(async (err) => {
    console.error(err);
    // best-effort cleanup
    await prismaRaw.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(() => {});
    await prismaRaw.accessRequest
      .deleteMany({ where: { email: { in: createdRequestEmails } } })
      .catch(() => {});
    process.exit(1);
  })
  .finally(() => prismaRaw.$disconnect());
