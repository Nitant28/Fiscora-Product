/**
 * Smoke test: Sprints 21 (Dynamic RBAC), 22 (Search), 24 (Audit Center),
 * 27 (API Platform).
 *   pnpm --filter api exec tsx scripts/testEnterpriseSprints.ts
 */
import { setTenantId } from "../src/lib/tenantContext";
import {
  seedRbacPermissions,
  setRolePermission,
  hasPermission,
  refreshRbacCache,
} from "../src/services/rbac";
import { runSearch } from "../src/services/search.service";
import {
  searchAuditLogs,
  getAuditFacets,
  exportAuditLogsCsv,
} from "../src/services/auditCenter";
import {
  createApiKey,
  listApiKeys,
  verifyApiKey,
  revokeApiKey,
} from "../src/services/apiKey.service";

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

const actor = { id: 1, name: "Smoke Test Admin", role: "ADMIN" as const };

async function main() {
  console.log("\n── Sprint 21: Dynamic RBAC ──\n");
  await seedRbacPermissions();
  await refreshRbacCache();

  // Grant a permission MANAGER doesn't have by default.
  await setRolePermission({
    role: "MANAGER",
    permissionKey: "contract.manage",
    enabled: true,
    actor,
  });
  check(
    "MANAGER granted contract.manage",
    hasPermission("MANAGER", "contract.manage")
  );

  await setRolePermission({
    role: "MANAGER",
    permissionKey: "contract.manage",
    enabled: false,
    actor,
  });
  check(
    "MANAGER revoked contract.manage",
    !hasPermission("MANAGER", "contract.manage")
  );

  let adminProtected = false;
  try {
    await setRolePermission({
      role: "ADMIN",
      permissionKey: "vendor.view",
      enabled: false,
      actor,
    });
  } catch {
    adminProtected = true;
  }
  check("ADMIN role is protected from edits", adminProtected);

  console.log("\n── Sprint 22: Enterprise Search ──\n");
  const adminSearch = await runSearch("ADMIN", "a");
  check("short query returns nothing", adminSearch.total === 0);

  const vendorSearch = await runSearch("ADMIN", "in");
  check("admin search returns groups", Array.isArray(vendorSearch.groups));

  // EMPLOYEE cannot see employees/departments (no user.manage).
  const empSearch = await runSearch("EMPLOYEE", "in");
  const empHasEmployees = empSearch.groups.some(
    (g) => g.type === "employee" || g.type === "department"
  );
  check("RBAC hides employee/department from EMPLOYEE", !empHasEmployees);

  console.log("\n── Sprint 24: Audit Center ──\n");
  const facets = await getAuditFacets();
  check("audit facets include RolePermission", facets.entityTypes.length > 0);

  const logs = await searchAuditLogs({ entityType: "RolePermission", limit: 10 });
  check("RBAC changes are audited", logs.items.length > 0);

  const csv = await exportAuditLogsCsv({ limit: 5 });
  check("CSV export has header row", csv.startsWith("id,createdAt,actor"));

  console.log("\n── Sprint 27: API Platform ──\n");
  const created = await createApiKey({
    tenantId: 1,
    name: "Smoke Test Key",
    scopes: ["read:vendors", "bogus:scope"],
    actor,
  });
  check("key secret returned once", created.secret.startsWith("fsk_live_"));
  check("invalid scope filtered out", created.scopes.length === 1);

  const verified = await verifyApiKey(created.secret);
  check("valid key verifies", verified?.tenantId === 1);

  const badVerify = await verifyApiKey("fsk_live_wrongkey");
  check("invalid key rejected", badVerify === null);

  const keys = await listApiKeys(1);
  check("key appears in list", keys.some((k) => k.id === created.id));
  check(
    "list never exposes secret",
    !keys.some((k) => "secret" in (k as Record<string, unknown>))
  );

  await revokeApiKey({ tenantId: 1, keyId: created.id, actor });
  const afterRevoke = await verifyApiKey(created.secret);
  check("revoked key no longer verifies", afterRevoke === null);

  console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
