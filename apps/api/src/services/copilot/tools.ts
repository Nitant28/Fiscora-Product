/**
 * Copilot Tools — the ONLY way the copilot may touch Fiscora data.
 *
 * The LLM never queries the database. It can only trigger these approved,
 * permission-gated tools, each of which is tenant-scoped (via the extended
 * prisma client) and RBAC-checked. This is what makes the copilot safe,
 * auditable, and impossible to jailbreak into leaking cross-tenant data.
 */
import type { UserRole } from "@prisma/client";
import prisma from "../../db";
import { hasPermission } from "../../lib/auth";
import { PERMISSION_KEYS } from "../../lib/permissions";
import { runSearch, type SearchResult } from "../search.service";
import { resolveNavigation, accessiblePages } from "./navigation";
import { searchKnowledge } from "./knowledge";

export interface ToolContext {
  role: UserRole;
  userId: number;
  userName: string;
}

export interface ToolResult {
  /** Structured, grounded data — the source of truth for the answer. */
  data: Record<string, unknown>;
  /** Standardised entity hits (for UI result lists). */
  results: SearchResult[];
  /** Optional deterministic navigation target. */
  navigate?: { label: string; path: string };
  /** True when the user lacked permission (answer must not leak data). */
  denied?: boolean;
}

export interface CopilotTool {
  name: string;
  /** Permission required, or null for any authenticated user. */
  permission: string | null;
  run: (ctx: ToolContext, query: string) => Promise<ToolResult>;
}

const searchTool: CopilotTool = {
  name: "search",
  permission: null, // runSearch applies per-provider RBAC internally
  async run(ctx, query) {
    const res = await runSearch(ctx.role, query);
    const top = res.results[0];
    return {
      data: {
        query: res.query,
        total: res.total,
        groups: res.groups.map((g) => ({ type: g.label, count: g.results.length })),
      },
      results: res.results.slice(0, 8),
      navigate: top ? { label: top.title, path: top.url } : undefined,
    };
  },
};

const pendingApprovalsTool: CopilotTool = {
  name: "pending_approvals",
  permission: PERMISSION_KEYS.APPROVAL_VIEW,
  async run() {
    const rows = await prisma.purchaseRequest.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { id: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        requester: true,
        estimatedAmount: true,
        status: true,
      },
    });

    const results: SearchResult[] = rows.map((r) => ({
      id: String(r.id),
      type: "purchase-request",
      title: r.title,
      subtitle: `Requested by ${r.requester} · ₹${r.estimatedAmount.toLocaleString("en-IN")}`,
      status: String(r.status),
      icon: "clipboard",
      url: `/requests/${r.id}`,
      score: 100,
    }));

    return {
      data: {
        total: rows.length,
        totalValue: rows.reduce((s, r) => s + r.estimatedAmount, 0),
      },
      results,
      navigate: { label: "Approvals Inbox", path: "/approvals" },
    };
  },
};

const navigateTool: CopilotTool = {
  name: "navigate",
  permission: null, // resolveNavigation filters by RBAC internally
  async run(ctx, query) {
    const match = resolveNavigation(ctx.role, query);
    if (!match) {
      return { data: { matched: false, query }, results: [] };
    }
    return {
      data: { matched: true, label: match.page.label, path: match.page.path },
      results: [],
      navigate: { label: match.page.label, path: match.page.path },
    };
  },
};

const knowledgeTool: CopilotTool = {
  name: "knowledge",
  permission: null, // documentation — safe for any authenticated user
  async run(ctx, query) {
    const hits = searchKnowledge(query, 3);
    if (hits.length === 0) {
      return { data: { matched: false, query }, results: [] };
    }
    const top = hits[0].article;

    // Offer navigation only if the article maps to a page the role can access.
    let navigate: { label: string; path: string } | undefined;
    if (top.route) {
      const page = accessiblePages(ctx.role).find((p) => p.path === top.route);
      if (page) navigate = { label: page.label, path: page.path };
    }

    return {
      data: {
        matched: true,
        title: top.title,
        category: top.category,
        // The grounding text the LLM may rephrase — nothing else.
        article: top.body,
        related: hits.slice(1).map((h) => h.article.title),
      },
      results: [],
      navigate,
    };
  },
};

export const TOOLS: Record<string, CopilotTool> = {
  search: searchTool,
  pending_approvals: pendingApprovalsTool,
  navigate: navigateTool,
  knowledge: knowledgeTool,
};

/** Runs a tool, enforcing its permission. Returns a denied result (never throws
 * a leak) when the role lacks access. */
export async function runTool(
  name: keyof typeof TOOLS | string,
  ctx: ToolContext,
  query: string
): Promise<{ tool: string; result: ToolResult; permission: string | null }> {
  const tool = TOOLS[name];
  if (!tool) {
    return {
      tool: String(name),
      permission: null,
      result: { data: { error: "unknown_tool" }, results: [] },
    };
  }

  if (tool.permission && !hasPermission(ctx.role, tool.permission)) {
    return {
      tool: tool.name,
      permission: tool.permission,
      result: { data: { denied: true }, results: [], denied: true },
    };
  }

  const result = await tool.run(ctx, query);
  return { tool: tool.name, permission: tool.permission, result };
}
