/**
 * Copilot Navigation Registry.
 *
 * Every navigable page registers itself here with keywords and the permission
 * required to see it. Navigation is resolved DETERMINISTICALLY by keyword
 * scoring — the LLM never guesses a URL — and is always filtered by the user's
 * RBAC so the copilot can never route someone to a page they can't access.
 */
import type { UserRole } from "@prisma/client";
import { hasPermission } from "../../lib/auth";
import { PERMISSION_KEYS } from "../../lib/permissions";

export interface CopilotPage {
  id: string;
  label: string;
  path: string;
  /** null = visible to any authenticated user. */
  permission: string | null;
  keywords: string[];
}

export const PAGE_REGISTRY: CopilotPage[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    permission: null,
    keywords: ["dashboard", "home", "overview", "control tower", "kpi", "summary"],
  },
  {
    id: "requests",
    label: "Purchase Requests",
    path: "/requests",
    permission: PERMISSION_KEYS.REQUEST_VIEW,
    keywords: ["request", "requests", "purchase request", "pr", "requisition", "raise request"],
  },
  {
    id: "approvals",
    label: "Approvals Inbox",
    path: "/approvals",
    permission: PERMISSION_KEYS.APPROVAL_VIEW,
    keywords: ["approval", "approvals", "approve", "inbox", "pending approval", "my approvals", "awaiting"],
  },
  {
    id: "rfqs",
    label: "RFQs",
    path: "/rfqs",
    permission: PERMISSION_KEYS.RFQ_VIEW,
    keywords: ["rfq", "rfqs", "request for quote", "bidding", "quotes", "tender"],
  },
  {
    id: "purchase-orders",
    label: "Purchase Orders",
    path: "/purchase-orders",
    permission: PERMISSION_KEYS.PO_VIEW,
    keywords: ["po", "purchase order", "purchase orders", "orders"],
  },
  {
    id: "vendors",
    label: "Vendors",
    path: "/vendors",
    permission: PERMISSION_KEYS.VENDOR_VIEW,
    keywords: ["vendor", "vendors", "supplier", "suppliers", "vendor list", "vendor directory"],
  },
  {
    id: "vendor-approvals",
    label: "Vendor Onboarding Approvals",
    path: "/vendor-onboarding/admin",
    permission: PERMISSION_KEYS.VENDOR_INVITE,
    keywords: ["vendor approval", "vendor approvals", "vendor onboarding", "approve vendor", "onboard vendor"],
  },
  {
    id: "invoices",
    label: "Invoices & Documents",
    path: "/documents",
    permission: PERMISSION_KEYS.INVOICE_VIEW,
    keywords: ["invoice", "invoices", "document", "documents", "bill", "bills", "upload invoice"],
  },
  {
    id: "payments",
    label: "Payments",
    path: "/payments",
    permission: PERMISSION_KEYS.PAYMENT_VIEW,
    keywords: ["payment", "payments", "pay", "disbursement", "remittance"],
  },
  {
    id: "contracts",
    label: "Contracts",
    path: "/contracts",
    permission: PERMISSION_KEYS.CONTRACT_VIEW,
    keywords: ["contract", "contracts", "agreement", "renewal", "obligation"],
  },
  {
    id: "analytics",
    label: "Analytics & Control Tower",
    path: "/analytics",
    permission: PERMISSION_KEYS.CONTROL_VIEW,
    keywords: ["analytics", "report", "reports", "spend", "savings", "insights", "control tower"],
  },
  {
    id: "compliance",
    label: "Compliance & Vendor Risk",
    path: "/compliance",
    permission: PERMISSION_KEYS.COMPLIANCE_VIEW,
    keywords: ["compliance", "risk", "vendor risk", "gst", "pan", "kyc"],
  },
  {
    id: "audit",
    label: "Audit Center",
    path: "/admin/audit",
    permission: PERMISSION_KEYS.AUDIT_VIEW,
    keywords: ["audit", "audit log", "audit trail", "activity", "history", "compliance report"],
  },
  {
    id: "permissions",
    label: "Roles & Permissions",
    path: "/admin/permissions",
    permission: PERMISSION_KEYS.ROLE_MANAGE,
    keywords: ["permission", "permissions", "role", "roles", "rbac", "access matrix"],
  },
  {
    id: "users",
    label: "User Management",
    path: "/settings/users",
    permission: PERMISSION_KEYS.USER_MANAGE,
    keywords: ["user", "users", "employee", "employees", "team", "invite user", "manage users"],
  },
  {
    id: "departments",
    label: "Departments",
    path: "/settings/departments",
    permission: PERMISSION_KEYS.USER_MANAGE,
    keywords: ["department", "departments", "cost center", "budget"],
  },
  {
    id: "developer",
    label: "Developer / API",
    path: "/settings/developer",
    permission: PERMISSION_KEYS.API_KEY_MANAGE,
    keywords: ["api", "api key", "api keys", "developer", "integration", "webhook"],
  },
  {
    id: "billing",
    label: "Billing & Subscription",
    path: "/billing",
    permission: PERMISSION_KEYS.BILLING_VIEW,
    keywords: ["billing", "subscription", "plan", "invoice us", "seats", "upgrade"],
  },
  {
    id: "system",
    label: "System Health",
    path: "/admin/system",
    permission: PERMISSION_KEYS.SYSTEM_VIEW,
    keywords: ["system", "health", "status", "uptime", "queue", "monitoring"],
  },
  {
    id: "catalog",
    label: "Catalog",
    path: "/catalog",
    permission: PERMISSION_KEYS.REQUEST_VIEW,
    keywords: ["catalog", "catalogue", "items", "products", "shop"],
  },
];

export interface NavMatch {
  page: CopilotPage;
  score: number;
}

/** Pages this role may access. */
export function accessiblePages(role: UserRole): CopilotPage[] {
  return PAGE_REGISTRY.filter(
    (p) => p.permission === null || hasPermission(role, p.permission)
  );
}

/** Whole-word / whole-phrase containment: "poem" does NOT contain "po". */
function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack);
}

/**
 * Deterministically resolve the best page for a free-text query, restricted to
 * pages the role can access. Returns null when nothing scores above threshold.
 */
export function resolveNavigation(
  role: UserRole,
  query: string
): NavMatch | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  let best: NavMatch | null = null;

  for (const page of accessiblePages(role)) {
    let score = 0;
    for (const kw of page.keywords) {
      if (q === kw) {
        score = Math.max(score, 100);
      } else if (containsWord(q, kw)) {
        // Whole-word (not substring) match, so "poem" never matches "po".
        // Longer keyword matches are more specific → higher score.
        score = Math.max(score, 60 + Math.min(30, kw.length));
      } else if (kw.includes(q) && q.length >= 4) {
        score = Math.max(score, 45);
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { page, score };
    }
  }

  return best;
}
