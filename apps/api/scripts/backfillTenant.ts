/**
 * One-time backfill: assign all existing rows to the default tenant.
 * Run: pnpm --filter api exec tsx scripts/backfillTenant.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Company", slug: "default" },
  });

  const tenantId = tenant.id;

  const tables = [
    prisma.vendor.updateMany({ where: { tenantId: { not: tenantId } }, data: { tenantId } }),
    prisma.document.updateMany({ where: { tenantId: { not: tenantId } }, data: { tenantId } }),
    prisma.purchaseOrder.updateMany({ where: { tenantId: { not: tenantId } }, data: { tenantId } }),
    prisma.purchaseRequest.updateMany({ where: { tenantId: { not: tenantId } }, data: { tenantId } }),
    prisma.department.updateMany({ where: { tenantId: { not: tenantId } }, data: { tenantId } }),
    prisma.auditLog.updateMany({ where: { tenantId: { not: tenantId } }, data: { tenantId } }),
    prisma.user.updateMany({ where: { tenantId: { not: tenantId } }, data: { tenantId } }),
    prisma.contract.updateMany({ where: { tenantId: { not: tenantId } }, data: { tenantId } }),
    prisma.payment.updateMany({ where: { tenantId: { not: tenantId } }, data: { tenantId } }),
    prisma.rFQ.updateMany({ where: { tenantId: { not: tenantId } }, data: { tenantId } }),
  ] as const;

  const results = await Promise.all(tables);
  const total = results.reduce((sum, r) => sum + r.count, 0);

  console.log(`Backfill complete for tenant "${tenant.slug}" (id=${tenantId}). Rows updated: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
