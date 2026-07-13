/**
 * Client-side RBAC: permission keys, role fallbacks, nav visibility, and route guards.
 * Aligns with API seed roles; used by middleware/layout indirectly and by pages directly.
 */

// ---------------------------------------------------------------------------
// Permission key constants (must match API permission strings)
// ---------------------------------------------------------------------------

export const PERMISSION_KEYS = {
  REQUEST_CREATE: "request.create",
  REQUEST_APPROVE: "request.approve",
  REQUEST_REJECT: "request.reject",
  REQUEST_VIEW: "request.view",
  RFQ_CREATE: "rfq.create",
  RFQ_OPEN: "rfq.open",
  RFQ_AWARD: "rfq.award",
  RFQ_VIEW: "rfq.view",
  RFQ_MANAGE: "rfq.manage",
  INVOICE_APPROVE: "invoice.approve",
  INVOICE_VIEW: "invoice.view",
  INVOICE_UPLOAD: "invoice.upload",
  PAYMENT_APPROVE: "payment.approve",
  PAYMENT_MARK_PAID: "payment.mark_paid",
  PAYMENT_VIEW: "payment.view",
  PAYMENT_PROCESS: "payment.process",
  AUDIT_VIEW: "audit.view",
  AUDIT_EXPORT: "audit.export",
  COMPLIANCE_VIEW: "compliance.view",
  TALLY_EXPORT: "tally.export",
  CONTRACT_VIEW: "contract.view",
  CONTRACT_MANAGE: "contract.manage",
  CASHFORECAST_VIEW: "cashforecast.view",
  CONTROL_VIEW: "control.view",
  VENDOR_MANAGE: "vendor.manage",
  VENDOR_INVITE: "vendor.invite",
  VENDOR_VIEW: "vendor.view",
  VENDOR_PORTAL_ACCESS: "vendor.portal.access",
  VENDOR_BID_SUBMIT: "vendor.bid.submit",
  VENDOR_PAYMENT_VIEW: "vendor.payment.view",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  PO_VIEW: "po.view",
  PO_CREATE: "po.create",
  PO_SEND: "po.send",
  PO_RECEIVE: "po.receive",
  PO_MANAGE: "po.manage",
  GRN_CREATE: "grn.create",
  CATALOG_MANAGE: "catalog.manage",
  APPROVAL_VIEW: "approval.view",
  APPROVAL_RULE_MANAGE: "approval_rule.manage",
  NOTIFICATION_VIEW: "notification.view",
  SYSTEM_VIEW: "system.view",
  BILLING_VIEW: "billing.view",
  BILLING_MANAGE: "billing.manage",
  API_KEY_MANAGE: "apikey.manage",
} as const;

export type PermissionKey =
  (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

export type UserWithPermissions = {
  role?: string;
  permissions?: string[];
};

// ---------------------------------------------------------------------------
// Role → permissions fallback (when /auth/me omits explicit permissions[])
// ---------------------------------------------------------------------------

/** Mirrors API seed matrix — used when /auth/me has no permissions yet. */
export const ROLE_PERMISSION_MATRIX: Record<
  string,
  PermissionKey[]
> = {
  EMPLOYEE: [
    PERMISSION_KEYS.REQUEST_CREATE,
    PERMISSION_KEYS.REQUEST_VIEW,
    PERMISSION_KEYS.RFQ_VIEW,
    PERMISSION_KEYS.INVOICE_VIEW,
    PERMISSION_KEYS.INVOICE_UPLOAD,
    PERMISSION_KEYS.PAYMENT_VIEW,
    PERMISSION_KEYS.PO_VIEW,
    PERMISSION_KEYS.PO_RECEIVE,
    PERMISSION_KEYS.VENDOR_VIEW,
    PERMISSION_KEYS.APPROVAL_VIEW,
    PERMISSION_KEYS.NOTIFICATION_VIEW,
  ],
  MANAGER: [
    PERMISSION_KEYS.REQUEST_CREATE,
    PERMISSION_KEYS.REQUEST_APPROVE,
    PERMISSION_KEYS.REQUEST_REJECT,
    PERMISSION_KEYS.REQUEST_VIEW,
    PERMISSION_KEYS.RFQ_VIEW,
    PERMISSION_KEYS.INVOICE_VIEW,
    PERMISSION_KEYS.INVOICE_UPLOAD,
    PERMISSION_KEYS.PAYMENT_VIEW,
    PERMISSION_KEYS.PO_VIEW,
    PERMISSION_KEYS.PO_RECEIVE,
    PERMISSION_KEYS.VENDOR_VIEW,
    PERMISSION_KEYS.APPROVAL_VIEW,
    PERMISSION_KEYS.NOTIFICATION_VIEW,
  ],
  DIRECTOR: [
    PERMISSION_KEYS.REQUEST_CREATE,
    PERMISSION_KEYS.REQUEST_APPROVE,
    PERMISSION_KEYS.REQUEST_REJECT,
    PERMISSION_KEYS.REQUEST_VIEW,
    PERMISSION_KEYS.RFQ_VIEW,
    PERMISSION_KEYS.INVOICE_VIEW,
    PERMISSION_KEYS.INVOICE_UPLOAD,
    PERMISSION_KEYS.PAYMENT_VIEW,
    PERMISSION_KEYS.CONTRACT_VIEW,
    PERMISSION_KEYS.CASHFORECAST_VIEW,
    PERMISSION_KEYS.CONTROL_VIEW,
    PERMISSION_KEYS.PO_VIEW,
    PERMISSION_KEYS.PO_RECEIVE,
    PERMISSION_KEYS.VENDOR_VIEW,
    PERMISSION_KEYS.APPROVAL_VIEW,
    PERMISSION_KEYS.NOTIFICATION_VIEW,
  ],
  PROCUREMENT: [
    PERMISSION_KEYS.REQUEST_CREATE,
    PERMISSION_KEYS.REQUEST_APPROVE,
    PERMISSION_KEYS.REQUEST_REJECT,
    PERMISSION_KEYS.REQUEST_VIEW,
    PERMISSION_KEYS.RFQ_CREATE,
    PERMISSION_KEYS.RFQ_OPEN,
    PERMISSION_KEYS.RFQ_AWARD,
    PERMISSION_KEYS.RFQ_VIEW,
    PERMISSION_KEYS.RFQ_MANAGE,
    PERMISSION_KEYS.INVOICE_VIEW,
    PERMISSION_KEYS.INVOICE_UPLOAD,
    PERMISSION_KEYS.PAYMENT_VIEW,
    PERMISSION_KEYS.CONTRACT_VIEW,
    PERMISSION_KEYS.CONTRACT_MANAGE,
    PERMISSION_KEYS.CONTROL_VIEW,
    PERMISSION_KEYS.VENDOR_MANAGE,
    PERMISSION_KEYS.VENDOR_INVITE,
    PERMISSION_KEYS.VENDOR_VIEW,
    PERMISSION_KEYS.COMPLIANCE_VIEW,
    PERMISSION_KEYS.PO_VIEW,
    PERMISSION_KEYS.PO_CREATE,
    PERMISSION_KEYS.PO_SEND,
    PERMISSION_KEYS.PO_RECEIVE,
    PERMISSION_KEYS.PO_MANAGE,
    PERMISSION_KEYS.GRN_CREATE,
    PERMISSION_KEYS.CATALOG_MANAGE,
    PERMISSION_KEYS.APPROVAL_RULE_MANAGE,
    PERMISSION_KEYS.APPROVAL_VIEW,
    PERMISSION_KEYS.NOTIFICATION_VIEW,
  ],
  FINANCE: [
    PERMISSION_KEYS.REQUEST_VIEW,
    PERMISSION_KEYS.INVOICE_APPROVE,
    PERMISSION_KEYS.INVOICE_VIEW,
    PERMISSION_KEYS.PAYMENT_APPROVE,
    PERMISSION_KEYS.PAYMENT_MARK_PAID,
    PERMISSION_KEYS.PAYMENT_VIEW,
    PERMISSION_KEYS.PAYMENT_PROCESS,
    PERMISSION_KEYS.VENDOR_VIEW,
    PERMISSION_KEYS.COMPLIANCE_VIEW,
    PERMISSION_KEYS.TALLY_EXPORT,
    PERMISSION_KEYS.PO_VIEW,
    PERMISSION_KEYS.APPROVAL_VIEW,
    PERMISSION_KEYS.NOTIFICATION_VIEW,
  ],
  CFO: [
    PERMISSION_KEYS.REQUEST_APPROVE,
    PERMISSION_KEYS.REQUEST_REJECT,
    PERMISSION_KEYS.REQUEST_VIEW,
    PERMISSION_KEYS.RFQ_OPEN,
    PERMISSION_KEYS.RFQ_AWARD,
    PERMISSION_KEYS.RFQ_VIEW,
    PERMISSION_KEYS.INVOICE_APPROVE,
    PERMISSION_KEYS.INVOICE_VIEW,
    PERMISSION_KEYS.PAYMENT_APPROVE,
    PERMISSION_KEYS.PAYMENT_MARK_PAID,
    PERMISSION_KEYS.PAYMENT_VIEW,
    PERMISSION_KEYS.PAYMENT_PROCESS,
    PERMISSION_KEYS.CONTRACT_VIEW,
    PERMISSION_KEYS.CONTRACT_MANAGE,
    PERMISSION_KEYS.CASHFORECAST_VIEW,
    PERMISSION_KEYS.CONTROL_VIEW,
    PERMISSION_KEYS.AUDIT_VIEW,
    PERMISSION_KEYS.AUDIT_EXPORT,
    PERMISSION_KEYS.COMPLIANCE_VIEW,
    PERMISSION_KEYS.TALLY_EXPORT,
    PERMISSION_KEYS.VENDOR_VIEW,
    PERMISSION_KEYS.PO_VIEW,
    PERMISSION_KEYS.APPROVAL_RULE_MANAGE,
    PERMISSION_KEYS.APPROVAL_VIEW,
    PERMISSION_KEYS.NOTIFICATION_VIEW,
  ],
  AUDITOR: [
    PERMISSION_KEYS.AUDIT_VIEW,
    PERMISSION_KEYS.AUDIT_EXPORT,
    PERMISSION_KEYS.COMPLIANCE_VIEW,
    PERMISSION_KEYS.REQUEST_VIEW,
    PERMISSION_KEYS.INVOICE_VIEW,
    PERMISSION_KEYS.PAYMENT_VIEW,
    PERMISSION_KEYS.CONTRACT_VIEW,
    PERMISSION_KEYS.VENDOR_VIEW,
    PERMISSION_KEYS.NOTIFICATION_VIEW,
  ],
  ADMIN: Object.values(PERMISSION_KEYS),
  VENDOR: [
    PERMISSION_KEYS.RFQ_VIEW,
    PERMISSION_KEYS.VENDOR_PORTAL_ACCESS,
    PERMISSION_KEYS.VENDOR_BID_SUBMIT,
    PERMISSION_KEYS.VENDOR_PAYMENT_VIEW,
    PERMISSION_KEYS.PO_VIEW,
    PERMISSION_KEYS.INVOICE_VIEW,
    PERMISSION_KEYS.NOTIFICATION_VIEW,
  ],
};

// ---------------------------------------------------------------------------
// Permission resolution and checks
// ---------------------------------------------------------------------------

export function resolveUserPermissions(
  user: UserWithPermissions | null | undefined
): string[] {
  const roleKey =
    user?.role?.toUpperCase?.() ?? user?.role;
  const fromRole = roleKey
    ? (ROLE_PERMISSION_MATRIX[roleKey] ?? [])
    : [];

  if (user?.permissions?.length) {
    return [...new Set([...user.permissions, ...fromRole])];
  }

  return fromRole;
}

export function hasPermission(
  user: UserWithPermissions | null | undefined,
  permission: PermissionKey | string
): boolean {
  return resolveUserPermissions(user).includes(
    permission
  );
}

export const can = hasPermission;

// ---------------------------------------------------------------------------
// Sidebar navigation (optional permission gates per link)
// ---------------------------------------------------------------------------

export const NAV_ITEMS: {
  href: string;
  label: string;
  permission?: PermissionKey;
  className?: string;
}[] = [
  { href: "/dashboard", label: "Dashboard" },
  {
    href: "/control-tower",
    label: "Control Tower",
    permission: PERMISSION_KEYS.CONTROL_VIEW,
  },
  {
    href: "/cfo",
    label: "CFO Dashboard",
    permission: PERMISSION_KEYS.CASHFORECAST_VIEW,
    className: "font-medium text-violet-700 hover:bg-violet-50",
  },
  {
    href: "/rfqs",
    label: "RFQs",
    permission: PERMISSION_KEYS.RFQ_VIEW,
    className: "font-medium text-blue-700 hover:bg-blue-50",
  },
  {
    href: "/approvals",
    label: "My Approvals",
    permission: PERMISSION_KEYS.APPROVAL_VIEW,
  },
  { href: "/notifications", label: "Notifications" },
  {
    href: "/catalog",
    label: "Catalog",
    permission: PERMISSION_KEYS.REQUEST_VIEW,
  },
  {
    href: "/requests",
    label: "Requests",
    permission: PERMISSION_KEYS.REQUEST_VIEW,
  },
  {
    href: "/vendors",
    label: "Vendors",
    permission: PERMISSION_KEYS.VENDOR_VIEW,
  },
  {
    href: "/contracts",
    label: "Contracts",
    permission: PERMISSION_KEYS.CONTRACT_VIEW,
    className: "font-medium text-indigo-700 hover:bg-indigo-50",
  },
  {
    href: "/contracts/intelligence",
    label: "Contract Intelligence",
    permission: PERMISSION_KEYS.CONTRACT_VIEW,
    className: "font-medium text-indigo-700 hover:bg-indigo-50",
  },
  {
    href: "/contracts/renewals",
    label: "Renewal Queue",
    permission: PERMISSION_KEYS.CONTRACT_VIEW,
    className: "font-medium text-indigo-700 hover:bg-indigo-50",
  },
  {
    href: "/executive/recommendations",
    label: "Executive Feed",
    permission: PERMISSION_KEYS.CONTRACT_VIEW,
    className: "font-medium text-indigo-700 hover:bg-indigo-50",
  },
  {
    href: "/analytics",
    label: "Procurement Intelligence",
    permission: PERMISSION_KEYS.CONTROL_VIEW,
    className: "font-medium text-violet-700 hover:bg-violet-50",
  },
  {
    href: "/savings",
    label: "Savings Intelligence",
    permission: PERMISSION_KEYS.CONTROL_VIEW,
    className: "font-medium text-emerald-700 hover:bg-emerald-50",
  },
  {
    href: "/roi",
    label: "ROI",
    permission: PERMISSION_KEYS.CONTROL_VIEW,
    className: "font-medium text-emerald-700 hover:bg-emerald-50",
  },
  {
    href: "/vendor-onboarding/admin",
    label: "Vendor Onboarding",
    permission: PERMISSION_KEYS.VENDOR_INVITE,
  },
  {
    href: "/integrations/tally",
    label: "Tally Export",
    permission: PERMISSION_KEYS.TALLY_EXPORT,
    className: "font-medium text-teal-700 hover:bg-teal-50",
  },
  {
    href: "/compliance",
    label: "Compliance",
    permission: PERMISSION_KEYS.COMPLIANCE_VIEW,
    className: "font-medium text-rose-700 hover:bg-rose-50",
  },
  {
    href: "/audit-logs",
    label: "Audit Center",
    permission: PERMISSION_KEYS.AUDIT_VIEW,
  },
  {
    href: "/import",
    label: "Import Center",
    permission: PERMISSION_KEYS.USER_MANAGE,
    className: "font-medium text-blue-700 hover:bg-blue-50",
  },
  {
    href: "/onboarding",
    label: "Onboarding",
    permission: PERMISSION_KEYS.USER_MANAGE,
    className: "font-medium text-indigo-700 hover:bg-indigo-50",
  },
  {
    href: "/settings/users",
    label: "User Management",
    permission: PERMISSION_KEYS.USER_MANAGE,
    className: "font-medium text-slate-700 hover:bg-slate-50",
  },
  {
    href: "/settings/billing",
    label: "Billing",
    permission: PERMISSION_KEYS.BILLING_VIEW,
    className: "font-medium text-slate-700 hover:bg-slate-50",
  },
  {
    href: "/settings/access-requests",
    label: "Access Requests",
    permission: PERMISSION_KEYS.USER_MANAGE,
    className: "font-medium text-slate-700 hover:bg-slate-50",
  },
  {
    href: "/settings/developer",
    label: "Developer / API",
    permission: PERMISSION_KEYS.API_KEY_MANAGE,
    className: "font-medium text-slate-700 hover:bg-slate-50",
  },
  {
    href: "/admin/identity",
    label: "Identity",
    permission: PERMISSION_KEYS.USER_MANAGE,
    className: "font-medium text-slate-700 hover:bg-slate-50",
  },
  {
    href: "/admin/system",
    label: "System Admin",
    permission: PERMISSION_KEYS.SYSTEM_VIEW,
    className: "font-medium text-slate-700 hover:bg-slate-50",
  },
  {
    href: "/purchase-orders",
    label: "Purchase Orders",
    permission: PERMISSION_KEYS.PO_VIEW,
  },
  {
    href: "/invoices",
    label: "Invoices",
    permission: PERMISSION_KEYS.INVOICE_VIEW,
  },
  {
    href: "/payments",
    label: "Payments",
    permission: PERMISSION_KEYS.PAYMENT_VIEW,
    className: "font-medium text-emerald-700 hover:bg-emerald-50",
  },
  {
    href: "/upload",
    label: "Upload",
    permission: PERMISSION_KEYS.INVOICE_UPLOAD,
  },
];

// ---------------------------------------------------------------------------
// Grouped navigation (information architecture for the sidebar)
// ---------------------------------------------------------------------------

export type NavLink = {
  href: string;
  label: string;
  permission?: PermissionKey;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavLink[];
};

/**
 * Grouped sidebar IA. The Dashboard stays top-level; everything else is
 * organized into collapsible sections so the sidebar scales as modules grow.
 * Each link is still permission-gated and filtered per role at render time.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "procurement",
    label: "Procurement",
    items: [
      { href: "/requests", label: "Requests", permission: PERMISSION_KEYS.REQUEST_VIEW },
      { href: "/catalog", label: "Catalog", permission: PERMISSION_KEYS.REQUEST_VIEW },
      { href: "/rfqs", label: "RFQs", permission: PERMISSION_KEYS.RFQ_VIEW },
      { href: "/purchase-orders", label: "Purchase Orders", permission: PERMISSION_KEYS.PO_VIEW },
      { href: "/vendors", label: "Vendors", permission: PERMISSION_KEYS.VENDOR_VIEW },
      { href: "/vendor-onboarding/admin", label: "Vendor Onboarding", permission: PERMISSION_KEYS.VENDOR_INVITE },
      { href: "/contracts", label: "Contracts", permission: PERMISSION_KEYS.CONTRACT_VIEW },
      { href: "/contracts/intelligence", label: "Contract Intelligence", permission: PERMISSION_KEYS.CONTRACT_VIEW },
      { href: "/contracts/renewals", label: "Renewal Queue", permission: PERMISSION_KEYS.CONTRACT_VIEW },
      { href: "/approvals", label: "My Approvals", permission: PERMISSION_KEYS.APPROVAL_VIEW },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { href: "/invoices", label: "Invoices", permission: PERMISSION_KEYS.INVOICE_VIEW },
      { href: "/upload", label: "Upload Invoice", permission: PERMISSION_KEYS.INVOICE_UPLOAD },
      { href: "/payments", label: "Payments", permission: PERMISSION_KEYS.PAYMENT_VIEW },
      { href: "/cfo", label: "CFO Dashboard", permission: PERMISSION_KEYS.CASHFORECAST_VIEW },
      { href: "/integrations/tally", label: "Tally Export", permission: PERMISSION_KEYS.TALLY_EXPORT },
    ],
  },
  {
    id: "operations",
    label: "Operations & Intelligence",
    items: [
      { href: "/control-tower", label: "Control Tower", permission: PERMISSION_KEYS.CONTROL_VIEW },
      { href: "/analytics", label: "Procurement Intelligence", permission: PERMISSION_KEYS.CONTROL_VIEW },
      { href: "/savings", label: "Savings Intelligence", permission: PERMISSION_KEYS.CONTROL_VIEW },
      { href: "/roi", label: "ROI", permission: PERMISSION_KEYS.CONTROL_VIEW },
      { href: "/executive/recommendations", label: "Executive Feed", permission: PERMISSION_KEYS.CONTRACT_VIEW },
      { href: "/compliance", label: "Compliance", permission: PERMISSION_KEYS.COMPLIANCE_VIEW },
      { href: "/admin/audit", label: "Audit Center", permission: PERMISSION_KEYS.AUDIT_VIEW },
      { href: "/notifications", label: "Notifications" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { href: "/settings/users", label: "User Management", permission: PERMISSION_KEYS.USER_MANAGE },
      { href: "/settings/access-requests", label: "Access Requests", permission: PERMISSION_KEYS.USER_MANAGE },
      { href: "/admin/identity", label: "Identity", permission: PERMISSION_KEYS.USER_MANAGE },
      { href: "/admin/permissions", label: "Roles & Permissions", permission: PERMISSION_KEYS.ROLE_MANAGE },
      { href: "/settings/billing", label: "Billing", permission: PERMISSION_KEYS.BILLING_VIEW },
      { href: "/settings/developer", label: "Developer / API", permission: PERMISSION_KEYS.API_KEY_MANAGE },
      { href: "/admin/system", label: "System Admin", permission: PERMISSION_KEYS.SYSTEM_VIEW },
      { href: "/import", label: "Import Center", permission: PERMISSION_KEYS.USER_MANAGE },
      { href: "/onboarding", label: "Onboarding", permission: PERMISSION_KEYS.USER_MANAGE },
    ],
  },
];

/** Returns only the groups/items the user is permitted to see. */
export function visibleNavGroups(
  user: UserWithPermissions | null | undefined
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || hasPermission(user, item.permission)
    ),
  })).filter((group) => group.items.length > 0);
}

// ---------------------------------------------------------------------------
// Page-level route guards (pathname → required permission)
// ---------------------------------------------------------------------------

export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  "/control-tower": PERMISSION_KEYS.CONTROL_VIEW,
  "/cfo": PERMISSION_KEYS.CASHFORECAST_VIEW,
  "/rfqs": PERMISSION_KEYS.RFQ_VIEW,
  "/approvals": PERMISSION_KEYS.APPROVAL_VIEW,
  "/catalog": PERMISSION_KEYS.REQUEST_VIEW,
  "/requests": PERMISSION_KEYS.REQUEST_VIEW,
  "/vendors": PERMISSION_KEYS.VENDOR_VIEW,
  "/contracts": PERMISSION_KEYS.CONTRACT_VIEW,
  "/contracts/intelligence": PERMISSION_KEYS.CONTRACT_VIEW,
  "/contracts/renewals": PERMISSION_KEYS.CONTRACT_VIEW,
  "/executive/recommendations": PERMISSION_KEYS.CONTRACT_VIEW,
  "/analytics": PERMISSION_KEYS.CONTROL_VIEW,
  "/savings": PERMISSION_KEYS.CONTROL_VIEW,
  "/roi": PERMISSION_KEYS.CONTROL_VIEW,
  "/vendor-onboarding/admin": PERMISSION_KEYS.VENDOR_INVITE,
  "/compliance": PERMISSION_KEYS.COMPLIANCE_VIEW,
  "/integrations/tally": PERMISSION_KEYS.TALLY_EXPORT,
  "/compliance/vendors": PERMISSION_KEYS.COMPLIANCE_VIEW,
  "/audit-logs": PERMISSION_KEYS.AUDIT_VIEW,
  "/import": PERMISSION_KEYS.USER_MANAGE,
  "/import/vendors": PERMISSION_KEYS.VENDOR_MANAGE,
  "/import/users": PERMISSION_KEYS.USER_MANAGE,
  "/import/departments": PERMISSION_KEYS.USER_MANAGE,
  "/import/budgets": PERMISSION_KEYS.USER_MANAGE,
  "/onboarding": PERMISSION_KEYS.USER_MANAGE,
  "/admin/system": PERMISSION_KEYS.SYSTEM_VIEW,
  "/admin/errors": PERMISSION_KEYS.SYSTEM_VIEW,
  "/admin/queues": PERMISSION_KEYS.SYSTEM_VIEW,
  "/admin/backups": PERMISSION_KEYS.SYSTEM_VIEW,
  "/admin/identity": PERMISSION_KEYS.USER_MANAGE,
  "/admin/permissions": PERMISSION_KEYS.ROLE_MANAGE,
  "/admin/audit": PERMISSION_KEYS.AUDIT_VIEW,
  "/settings/users": PERMISSION_KEYS.USER_MANAGE,
  "/settings/billing": PERMISSION_KEYS.BILLING_VIEW,
  "/settings/access-requests": PERMISSION_KEYS.USER_MANAGE,
  "/settings/developer": PERMISSION_KEYS.API_KEY_MANAGE,
  "/purchase-orders": PERMISSION_KEYS.PO_VIEW,
  "/invoices": PERMISSION_KEYS.INVOICE_VIEW,
  "/payments": PERMISSION_KEYS.PAYMENT_VIEW,
  "/upload": PERMISSION_KEYS.INVOICE_UPLOAD,
};

// ---------------------------------------------------------------------------
// Route access and legacy convenience helpers
// ---------------------------------------------------------------------------

export function canAccessRoute(
  pathname: string,
  user: UserWithPermissions | null | undefined
): boolean {
  const permission = ROUTE_PERMISSIONS[pathname];
  // Routes not listed are open to any authenticated user
  if (!permission) {
    return true;
  }

  return hasPermission(user, permission);
}

/** @deprecated use hasPermission(user, PERMISSION_KEYS.CASHFORECAST_VIEW) */
export function canViewCfoDashboard(
  user: UserWithPermissions | null | undefined
): boolean {
  return hasPermission(user, PERMISSION_KEYS.CASHFORECAST_VIEW);
}

/** @deprecated use hasPermission(user, PERMISSION_KEYS.CONTRACT_MANAGE) */
export function canManageContracts(
  user: UserWithPermissions | null | undefined
): boolean {
  return hasPermission(user, PERMISSION_KEYS.CONTRACT_MANAGE);
}

/** Executive dashboard — control tower + CFO analytics */
export function canViewExecutiveDashboard(
  user: UserWithPermissions | null | undefined
): boolean {
  return (
    hasPermission(user, PERMISSION_KEYS.CONTROL_VIEW) ||
    hasPermission(user, PERMISSION_KEYS.CASHFORECAST_VIEW)
  );
}

/** Savings intelligence and ROI reporting */
export function canViewSavingsIntelligence(
  user: UserWithPermissions | null | undefined
): boolean {
  return (
    canViewExecutiveDashboard(user) ||
    hasPermission(user, PERMISSION_KEYS.AUDIT_VIEW)
  );
}
