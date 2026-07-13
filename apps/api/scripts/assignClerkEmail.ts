/**
 * Dev helper: assign a Clerk email to a Fiscora role so first-login auto-link
 * binds the Clerk identity to a real, provisioned user.
 *
 * Two modes:
 *   1) Rename an existing seed user to your Clerk email (keeps that user's role):
 *        pnpm --filter api exec tsx scripts/assignClerkEmail.ts you@gmail.com ADMIN
 *      → sets the email of the ADMIN seed user to you@gmail.com
 *
 *   2) Update by explicit target email (rename a specific user):
 *        pnpm --filter api exec tsx scripts/assignClerkEmail.ts you@gmail.com --from admin@fiscora.com
 *
 * After running, sign in at /login with that email. On first request the backend
 * matches by email and stores your clerkId automatically.
 *
 * Roles: ADMIN | CFO | DIRECTOR | PROCUREMENT | MANAGER | FINANCE | AUDITOR | EMPLOYEE
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [rawEmail, second, third] = process.argv.slice(2);

  if (!rawEmail || !rawEmail.includes("@")) {
    console.error(
      "Usage: assignClerkEmail.ts <your-clerk-email> <ROLE | --from existing@email>\n" +
        "Example: assignClerkEmail.ts you@gmail.com ADMIN"
    );
    process.exit(1);
  }

  const clerkEmail = rawEmail.toLowerCase().trim();

  let targetUser;

  if (second === "--from" && third) {
    targetUser = await prisma.user.findFirst({
      where: { email: third.toLowerCase().trim() },
    });
    if (!targetUser) {
      console.error(`No user found with email ${third}`);
      process.exit(1);
    }
  } else {
    const role = (second ?? "ADMIN").toUpperCase();
    targetUser = await prisma.user.findFirst({
      where: { role: role as never },
      orderBy: { id: "asc" },
    });
    if (!targetUser) {
      console.error(`No user found with role ${role}`);
      process.exit(1);
    }
  }

  // If a different user already owns this email, stop (avoid collisions).
  const existing = await prisma.user.findFirst({
    where: { email: clerkEmail, tenantId: targetUser.tenantId },
  });
  if (existing && existing.id !== targetUser.id) {
    console.error(
      `Email ${clerkEmail} is already used by user #${existing.id} (${existing.role}).`
    );
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      email: clerkEmail,
      // Reset link so the next Clerk login re-binds cleanly.
      clerkId: null,
      status: "ACTIVE",
    },
    include: { department: true },
  });

  console.log("✓ Updated user for Clerk sign-in:");
  console.table([
    {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      tenantId: updated.tenantId,
      department: updated.department?.name ?? "—",
      status: updated.status,
    },
  ]);
  console.log(
    `\nNow sign in at /login with: ${updated.email}\n` +
      `On first request, your clerkId links automatically and you'll get the ${updated.role} dashboard.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
