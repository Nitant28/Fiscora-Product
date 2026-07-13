/**
 * Enterprise Search (Sprint 22).
 *
 * A provider registry runs every registered entity provider against the query,
 * merges + ranks the results, and applies RBAC so a user never sees entities
 * they lack permission to view. Providers own their own DB logic and always
 * return the standardized SearchResult shape. Tenancy is enforced by the
 * tenant-extended Prisma client (every query is scoped to the request tenant).
 *
 * Swapping the storage engine later (Meilisearch/Typesense) only requires
 * rewriting providers — the route and frontend never change.
 */
import type { UserRole } from "@prisma/client";
import prisma from "../db";
import { hasPermission } from "../lib/auth";
import { PERMISSION_KEYS } from "../lib/permissions";

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  status: string;
  icon: string;
  url: string;
  score: number;
}

interface SearchProvider {
  type: string;
  permission: string;
  search: (q: string, limit: number) => Promise<SearchResult[]>;
}

/** Ranks a candidate against the query: exact > prefix > contains. */
function score(query: string, primary: string, secondary = ""): number {
  const q = query.toLowerCase().trim();
  const p = (primary ?? "").toLowerCase();
  const s = (secondary ?? "").toLowerCase();
  if (!p && !s) return 0;
  if (p === q) return 100;
  if (p.startsWith(q)) return 90;
  if (p.includes(q)) return 70;
  if (s.includes(q)) return 50;
  return 30;
}

const registry: SearchProvider[] = [
  {
    type: "vendor",
    permission: PERMISSION_KEYS.VENDOR_VIEW,
    async search(q, limit) {
      const rows = await prisma.vendor.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { vendorCode: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { gstNumber: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          vendorCode: true,
          vendorType: true,
        },
      });
      return rows.map((r) => ({
        id: String(r.id),
        type: "vendor",
        title: r.name,
        subtitle: r.vendorCode
          ? `${r.vendorType} · ${r.vendorCode}`
          : r.vendorType,
        status: r.vendorType,
        icon: "building",
        url: `/vendors/${r.id}`,
        score: score(q, r.name, r.vendorCode ?? ""),
      }));
    },
  },
  {
    type: "purchase-order",
    permission: PERMISSION_KEYS.PO_VIEW,
    async search(q, limit) {
      const rows = await prisma.purchaseOrder.findMany({
        where: {
          OR: [
            { poNumber: { contains: q, mode: "insensitive" } },
            { vendorName: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        select: {
          id: true,
          poNumber: true,
          vendorName: true,
          status: true,
          amount: true,
        },
      });
      return rows.map((r) => ({
        id: String(r.id),
        type: "purchase-order",
        title: r.poNumber,
        subtitle: `${r.vendorName} · ₹${r.amount.toLocaleString("en-IN")}`,
        status: r.status,
        icon: "file-text",
        url: `/purchase-orders/${r.id}`,
        score: score(q, r.poNumber, r.vendorName),
      }));
    },
  },
  {
    type: "purchase-request",
    permission: PERMISSION_KEYS.REQUEST_VIEW,
    async search(q, limit) {
      const rows = await prisma.purchaseRequest.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { vendorName: { contains: q, mode: "insensitive" } },
            { requester: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        select: {
          id: true,
          title: true,
          requester: true,
          status: true,
        },
      });
      return rows.map((r) => ({
        id: String(r.id),
        type: "purchase-request",
        title: r.title,
        subtitle: `Requested by ${r.requester}`,
        status: String(r.status),
        icon: "clipboard",
        url: `/requests/${r.id}`,
        score: score(q, r.title, r.requester),
      }));
    },
  },
  {
    type: "invoice",
    permission: PERMISSION_KEYS.INVOICE_VIEW,
    async search(q, limit) {
      const rows = await prisma.document.findMany({
        where: {
          OR: [
            { invoiceNumber: { contains: q, mode: "insensitive" } },
            { vendorName: { contains: q, mode: "insensitive" } },
            { fileName: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        select: {
          id: true,
          invoiceNumber: true,
          vendorName: true,
          fileName: true,
          status: true,
          totalAmount: true,
        },
      });
      return rows.map((r) => ({
        id: String(r.id),
        type: "invoice",
        title: r.invoiceNumber ?? r.fileName ?? `Invoice #${r.id}`,
        subtitle: r.vendorName ?? "Unknown vendor",
        status: String(r.status),
        icon: "receipt",
        url: `/documents/${r.id}`,
        score: score(
          q,
          r.invoiceNumber ?? r.fileName ?? "",
          r.vendorName ?? ""
        ),
      }));
    },
  },
  {
    type: "contract",
    permission: PERMISSION_KEYS.CONTRACT_VIEW,
    async search(q, limit) {
      const rows = await prisma.contract.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { contractNumber: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        select: {
          id: true,
          title: true,
          contractNumber: true,
          status: true,
        },
      });
      return rows.map((r) => ({
        id: String(r.id),
        type: "contract",
        title: r.title,
        subtitle: r.contractNumber,
        status: String(r.status),
        icon: "file-signature",
        url: `/contracts/${r.id}`,
        score: score(q, r.title, r.contractNumber),
      }));
    },
  },
  {
    type: "department",
    permission: PERMISSION_KEYS.USER_MANAGE,
    async search(q, limit) {
      const rows = await prisma.department.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: limit,
        select: { id: true, name: true, budget: true },
      });
      return rows.map((r) => ({
        id: String(r.id),
        type: "department",
        title: r.name,
        subtitle: `Budget ₹${r.budget.toLocaleString("en-IN")}`,
        status: "ACTIVE",
        icon: "layers",
        url: `/settings/departments`,
        score: score(q, r.name),
      }));
    },
  },
  {
    type: "employee",
    permission: PERMISSION_KEYS.USER_MANAGE,
    async search(q, limit) {
      const rows = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      });
      return rows.map((r) => ({
        id: String(r.id),
        type: "employee",
        title: r.name,
        subtitle: `${r.email} · ${r.role}`,
        status: String(r.status),
        icon: "user",
        url: `/settings/users`,
        score: score(q, r.name, r.email),
      }));
    },
  },
];

export interface SearchResponse {
  query: string;
  total: number;
  groups: { type: string; label: string; results: SearchResult[] }[];
  results: SearchResult[];
}

const TYPE_LABELS: Record<string, string> = {
  vendor: "Vendors",
  "purchase-order": "Purchase Orders",
  "purchase-request": "Purchase Requests",
  invoice: "Invoices",
  contract: "Contracts",
  department: "Departments",
  employee: "Employees",
};

/**
 * Runs every provider the role is permitted to use, merges + ranks results,
 * and groups them by type. RBAC is applied silently: forbidden entity types
 * are simply absent (never a 403), so sensitive data is never leaked.
 */
export async function runSearch(
  role: UserRole,
  rawQuery: string,
  perTypeLimit = 5
): Promise<SearchResponse> {
  const query = (rawQuery ?? "").trim();
  if (query.length < 2) {
    return { query, total: 0, groups: [], results: [] };
  }

  const allowed = registry.filter((p) =>
    hasPermission(role, p.permission)
  );

  const settled = await Promise.allSettled(
    allowed.map((p) => p.search(query, perTypeLimit))
  );

  const results: SearchResult[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      results.push(...r.value);
    }
  }

  results.sort((a, b) => b.score - a.score);

  const grouped = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = grouped.get(r.type) ?? [];
    list.push(r);
    grouped.set(r.type, list);
  }

  const groups = [...grouped.entries()].map(([type, list]) => ({
    type,
    label: TYPE_LABELS[type] ?? type,
    results: list,
  }));

  return {
    query,
    total: results.length,
    groups,
    results,
  };
}
