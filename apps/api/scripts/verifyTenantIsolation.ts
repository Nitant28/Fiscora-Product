/**
 * Sprint 14A exit test: Tenant A cannot see Tenant B vendors.
 * Run: pnpm --filter api exec tsx scripts/verifyTenantIsolation.ts
 */
import { PrismaClient } from "@prisma/client";
import { extendWithTenant } from "../src/lib/prismaTenant";
import { runWithTenantId } from "../src/lib/tenantContext";

const base = new PrismaClient();
const prisma = extendWithTenant(base);

async function main() {
  const tenantA = await base.tenant.upsert({
    where: { slug: "isolation-test-a" },
    update: {},
    create: { name: "Isolation Test A", slug: "isolation-test-a" },
  });

  const tenantB = await base.tenant.upsert({
    where: { slug: "isolation-test-b" },
    update: {},
    create: { name: "Isolation Test B", slug: "isolation-test-b" },
  });

  const vendorAName = `Vendor-A-${Date.now()}`;
  const vendorBName = `Vendor-B-${Date.now()}`;

  console.log(`  Tenant A id=${tenantA.id}, Tenant B id=${tenantB.id}`);

  const vendorA = await runWithTenantId(tenantA.id, async () =>
    prisma.vendor.create({
      data: { name: vendorAName, status: "ACTIVE" },
    })
  );

  const vendorB = await runWithTenantId(tenantB.id, async () =>
    prisma.vendor.create({
      data: { name: vendorBName, status: "ACTIVE" },
    })
  );

  console.log(`  Created vendorA tenantId=${vendorA.tenantId}, vendorB tenantId=${vendorB.tenantId}`);

  const visibleToA = await runWithTenantId(tenantA.id, async () =>
    prisma.vendor.findMany({
      where: { name: { in: [vendorAName, vendorBName] } },
    })
  );

  const visibleToB = await runWithTenantId(tenantB.id, async () =>
    prisma.vendor.findMany({
      where: { name: { in: [vendorAName, vendorBName] } },
    })
  );

  const aSeesOnlyOwn =
    visibleToA.length === 1 &&
    visibleToA[0]?.id === vendorA.id &&
    !visibleToA.some((v) => v.id === vendorB.id);

  const bSeesOnlyOwn =
    visibleToB.length === 1 &&
    visibleToB[0]?.id === vendorB.id &&
    !visibleToB.some((v) => v.id === vendorA.id);

  if (!aSeesOnlyOwn || !bSeesOnlyOwn) {
    console.error("FAIL: Cross-tenant vendor leakage detected");
    console.error({ visibleToA, visibleToB });
    process.exit(1);
  }

  console.log("PASS: Tenant isolation verified");
  console.log(`  Tenant A (${tenantA.slug}): sees vendor ${vendorA.id} only`);
  console.log(`  Tenant B (${tenantB.slug}): sees vendor ${vendorB.id} only`);

  await base.vendor.deleteMany({
    where: { id: { in: [vendorA.id, vendorB.id] } },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => base.$disconnect());
