/**
 * DEV/TEST: provision a Clerk login for every Fiscora role in one command.
 *
 *   pnpm --filter api exec tsx scripts/setupTestUsers.ts
 *
 * For each role it:
 *   1. Ensures the Fiscora User row exists and is ACTIVE (the system of record).
 *   2. Creates (or reuses) a Clerk account with a shared demo password.
 *   3. Links clerkId → User so the first login resolves the correct role instantly.
 *
 * After running, sign in at /login with any email below + the shared password.
 * This mirrors production identity (Clerk = who you are, Fiscora = your role),
 * but skips the email-invitation step so the whole role matrix is testable fast.
 *
 * Override the password with TEST_USER_PASSWORD=... if your Clerk instance has
 * stricter password rules.
 */
import { PrismaClient, type UserRole } from "@prisma/client";
import { ensureClerkUser } from "../src/lib/clerk";

const prisma = new PrismaClient();

const PASSWORD = process.env.TEST_USER_PASSWORD ?? "Fiscora@12345";

const ROLE_USERS: {
  email: string;
  name: string;
  role: UserRole;
}[] = [
  { email: "admin@fiscora.com", name: "Reshma Admin", role: "ADMIN" },
  { email: "cfo@fiscora.com", name: "Meera Iyer", role: "CFO" },
  { email: "director@fiscora.com", name: "Vikram Desai", role: "DIRECTOR" },
  {
    email: "procurement@fiscora.com",
    name: "Priya Procurement",
    role: "PROCUREMENT",
  },
  { email: "manager@fiscora.com", name: "Anika Patel", role: "MANAGER" },
  { email: "finance@fiscora.com", name: "Rajesh Kapoor", role: "FINANCE" },
  { email: "auditor@fiscora.com", name: "Ava Auditor", role: "AUDITOR" },
  {
    email: "employee@fiscora.com",
    name: "Rahul Sharma",
    role: "EMPLOYEE",
  },
];

async function main() {
  const tenant = await prisma.tenant.findFirst({
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  if (!tenant) {
    console.error(
      "No tenant found. Seed the database first (pnpm --filter api seed)."
    );
    process.exit(1);
  }

  console.log(
    `\nProvisioning ${ROLE_USERS.length} role logins in tenant "${tenant.name}" (#${tenant.id})\n`
  );

  const results: {
    email: string;
    role: string;
    clerk: string;
    linked: string;
  }[] = [];

  for (const entry of ROLE_USERS) {
    const email = entry.email.toLowerCase();

    // 1. Ensure the Fiscora user (system of record for role/permissions).
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name: entry.name,
          role: entry.role,
          status: "ACTIVE",
          // Clerk owns auth; this hash is unusable on purpose.
          passwordHash: "clerk-managed",
        },
      });
    } else if (user.status !== "ACTIVE" || user.role !== entry.role) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE", role: entry.role },
      });
    }

    // 2. Ensure the Clerk identity.
    const [firstName, ...rest] = entry.name.split(" ");
    const clerk = await ensureClerkUser({
      email,
      password: PASSWORD,
      firstName,
      lastName: rest.join(" ") || undefined,
    });

    if (!clerk.ok) {
      results.push({
        email,
        role: entry.role,
        clerk: `FAILED: ${clerk.reason}`,
        linked: "no",
      });
      continue;
    }

    // 3. Link clerkId → Fiscora user (idempotent).
    await prisma.user.update({
      where: { id: user.id },
      data: { clerkId: clerk.clerkId },
    });

    results.push({
      email,
      role: entry.role,
      clerk: clerk.created ? "created" : "reused",
      linked: "yes",
    });
  }

  console.table(results);
  console.log(`\nShared password for all accounts: ${PASSWORD}`);
  console.log(
    "Sign in at http://localhost:3000/login with any email above.\n" +
      "Each lands on its role's dashboard (clerkId already linked).\n"
  );

  const failures = results.filter((r) => r.linked === "no");
  if (failures.length) {
    console.warn(
      `${failures.length} account(s) could not be provisioned in Clerk. ` +
        "If your instance enforces verified emails or password rules, set " +
        "TEST_USER_PASSWORD or create those users in the Clerk dashboard."
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
