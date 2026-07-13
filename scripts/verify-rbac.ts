/**
 * =============================================================================
 * SCRIPT: verify-rbac.ts
 * LOCATION: scripts/
 * PURPOSE: Acceptance test for role-based access control — seeding, permission
 *          checks, audit logging, and login payload.
 *
 * WHAT IT DOES (4 phases):
 *   1. Seed RBAC permissions and count permission/role mappings
 *   2. Verify CFO, employee, and auditor roles against key permissions
 *   3. Record and read back an audit log with role/permission context
 *   4. Assert login returns a non-empty permissions array; exit 1 on failure
 *
 * RUN: npx tsx scripts/verify-rbac.ts
 * =============================================================================
 */

import prisma from "../apps/api/src/db";
import { hashPassword, loginUser } from "../apps/api/src/lib/auth";
import { PERMISSION_KEYS } from "../apps/api/src/lib/permissions";
import {
  getRolesForPermission,
  getUserPermissions,
  hasPermission,
  hasUserPermission,
  seedRbacPermissions,
} from "../apps/api/src/services/rbac";
import { recordAuditLog } from "../apps/api/src/lib/audit";

async function main() {
  /* =========================================================================
   * PHASE 1: Seed RBAC tables and load test users
   * ========================================================================= */
  await seedRbacPermissions();

  const permissionCount =
    await prisma.permission.count();
  const roleMappingCount =
    await prisma.rolePermission.count();

  const cfoUser = await prisma.user.findUnique({
    where: { email: "cfo@fiscora.com" },
  });
  const employeeUser = await prisma.user.findUnique({
    where: { email: "employee@fiscora.com" },
  });
  // Ensure auditor user exists for audit.view checks
  const auditorUser = await prisma.user.upsert({
    where: { email: "auditor@fiscora.com" },
    create: {
      email: "auditor@fiscora.com",
      name: "Ava Auditor",
      passwordHash: hashPassword("fiscora123"),
      role: "AUDITOR",
    },
    update: {
      role: "AUDITOR",
    },
  });

  /* =========================================================================
   * PHASE 2: Role vs permission matrix checks
   * ========================================================================= */
  const cfoCanPay =
    cfoUser &&
    hasPermission(
      cfoUser.role,
      PERMISSION_KEYS.PAYMENT_APPROVE
    );
  const employeeCannotPay =
    employeeUser &&
    !hasPermission(
      employeeUser.role,
      PERMISSION_KEYS.PAYMENT_APPROVE
    );
  const auditorCanViewAudit = hasPermission(
    auditorUser.role,
    PERMISSION_KEYS.AUDIT_VIEW
  );
  const employeeCannotViewAudit =
    employeeUser &&
    !hasPermission(
      employeeUser.role,
      PERMISSION_KEYS.AUDIT_VIEW
    );
  const employeeCannotAwardRfq =
    employeeUser &&
    !hasPermission(
      employeeUser.role,
      PERMISSION_KEYS.RFQ_AWARD
    );
  const employeeCannotManageVendors =
    employeeUser &&
    !hasPermission(
      employeeUser.role,
      PERMISSION_KEYS.VENDOR_MANAGE
    );
  const auditorCannotPay =
    !hasPermission(
      auditorUser.role,
      PERMISSION_KEYS.PAYMENT_APPROVE
    ) &&
    !hasPermission(
      auditorUser.role,
      PERMISSION_KEYS.PAYMENT_MARK_PAID
    );
  const auditorCannotAwardRfq =
    !hasPermission(
      auditorUser.role,
      PERMISSION_KEYS.RFQ_AWARD
    );
  const cfoCanForecast =
    cfoUser &&
    hasPermission(
      cfoUser.role,
      PERMISSION_KEYS.CASHFORECAST_VIEW
    );
  const cfoCanViewContracts =
    cfoUser &&
    hasPermission(
      cfoUser.role,
      PERMISSION_KEYS.CONTRACT_VIEW
    );
  const cfoCanManageApprovalRules =
    cfoUser &&
    hasPermission(
      cfoUser.role,
      PERMISSION_KEYS.APPROVAL_RULE_MANAGE
    );
  const cfoUserPermissions =
    cfoUser
      ? await getUserPermissions(cfoUser.id)
      : [];
  const cfoUserCanPay =
    cfoUser
      ? await hasUserPermission(
          cfoUser.id,
          PERMISSION_KEYS.PAYMENT_APPROVE
        )
      : false;
  const paymentApproverRoles = getRolesForPermission(
    PERMISSION_KEYS.PAYMENT_APPROVE
  );

  /* =========================================================================
   * PHASE 3: Audit log stores actor role and permission used
   * ========================================================================= */
  await recordAuditLog(
    "System",
    0,
    "RBAC Verification",
    "Verify Script",
    {
      actorContext: {
        userId: auditorUser.id,
        role: auditorUser.role,
        permission: PERMISSION_KEYS.AUDIT_VIEW,
      },
      newValue: { verified: true },
    }
  );

  const latestAudit = await prisma.auditLog.findFirst({
    where: { action: "RBAC Verification" },
    orderBy: { createdAt: "desc" },
  });

  /* =========================================================================
   * PHASE 4: Login payload and aggregate acceptance checks
   * ========================================================================= */
  const login = await loginUser(
    "cfo@fiscora.com",
    "fiscora123"
  );

  const checks = [
    {
      label: "Permission table seeded",
      pass: permissionCount >= 36,
      actual: permissionCount,
      expected: ">= 36",
    },
    {
      label: "Role-permission mappings seeded",
      pass: roleMappingCount >= 90,
      actual: roleMappingCount,
      expected: ">= 90",
    },
    {
      label: "CFO has payment.approve",
      pass: Boolean(cfoCanPay),
      actual: cfoCanPay,
      expected: true,
    },
    {
      label: "Employee lacks payment.approve",
      pass: Boolean(employeeCannotPay),
      actual: employeeCannotPay,
      expected: true,
    },
    {
      label: "Employee lacks rfq.award",
      pass: Boolean(employeeCannotAwardRfq),
      actual: employeeCannotAwardRfq,
      expected: true,
    },
    {
      label: "Employee lacks vendor.manage",
      pass: Boolean(employeeCannotManageVendors),
      actual: employeeCannotManageVendors,
      expected: true,
    },
    {
      label: "Auditor has audit.view",
      pass: auditorCanViewAudit,
      actual: auditorCanViewAudit,
      expected: true,
    },
    {
      label: "Employee lacks audit.view",
      pass: Boolean(employeeCannotViewAudit),
      actual: employeeCannotViewAudit,
      expected: true,
    },
    {
      label: "Auditor cannot approve or mark paid",
      pass: auditorCannotPay,
      actual: auditorCannotPay,
      expected: true,
    },
    {
      label: "Auditor cannot award RFQ",
      pass: auditorCannotAwardRfq,
      actual: auditorCannotAwardRfq,
      expected: true,
    },
    {
      label: "CFO can view cash forecast",
      pass: Boolean(cfoCanForecast),
      actual: cfoCanForecast,
      expected: true,
    },
    {
      label: "CFO can view contracts",
      pass: Boolean(cfoCanViewContracts),
      actual: cfoCanViewContracts,
      expected: true,
    },
    {
      label: "CFO can manage approval rules",
      pass: Boolean(cfoCanManageApprovalRules),
      actual: cfoCanManageApprovalRules,
      expected: true,
    },
    {
      label: "User-level permission helper resolves CFO permissions",
      pass:
        cfoUserPermissions.includes(
          PERMISSION_KEYS.PAYMENT_APPROVE
        ) && cfoUserCanPay,
      actual: {
        permissionCount:
          cfoUserPermissions.length,
        cfoUserCanPay,
      },
      expected: {
        includes: PERMISSION_KEYS.PAYMENT_APPROVE,
        cfoUserCanPay: true,
      },
    },
    {
      label: "Reverse permission cache resolves payment approver roles",
      pass: paymentApproverRoles.includes("CFO"),
      actual: paymentApproverRoles,
      expected: "includes CFO",
    },
    {
      label: "Audit log stores role and permission",
      pass:
        latestAudit?.actorRole === "AUDITOR" &&
        latestAudit?.permission === PERMISSION_KEYS.AUDIT_VIEW,
      actual: {
        actorRole: latestAudit?.actorRole,
        permission: latestAudit?.permission,
      },
      expected: {
        actorRole: "AUDITOR",
        permission: PERMISSION_KEYS.AUDIT_VIEW,
      },
    },
    {
      label: "Login returns permissions array",
      pass:
        Array.isArray(login?.user.permissions) &&
        (login?.user.permissions.length ?? 0) > 0,
      actual: login?.user.permissions?.length ?? 0,
      expected: "> 0",
    },
  ];

  let failed = 0;

  for (const check of checks) {
    const status = check.pass ? "PASS" : "FAIL";
    if (!check.pass) failed += 1;
    console.log(
      `[${status}] ${check.label}\n       actual: ${JSON.stringify(check.actual)}\n       expected: ${JSON.stringify(check.expected)}`
    );
  }

  if (failed > 0) {
    throw new Error(`${failed} RBAC verification check(s) failed`);
  }

  console.log("\nAll RBAC verification checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

