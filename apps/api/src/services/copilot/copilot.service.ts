/**
 * AI Copilot service (knowledge-first, grounded, explainable).
 *
 * Pipeline:
 *   message
 *     → detectIntent            (rules)
 *     → classifyScope           (Fiscora-only allowlist; refuse general knowledge)
 *     → approved tool           (RBAC + tenant-scoped: knowledge | search | approvals | navigate)
 *     → grounded data           (the ONLY source of truth)
 *     → LLM phrases it          (Gemini optional; deterministic fallback)
 *     → answer + navigation + provenance + audit log
 *
 * Source-of-truth priority: org DB / permissions / app state → Fiscora
 * knowledge base → internal tools → LLM reasoning (phrasing only). The LLM
 * never invents answers and never answers outside Fiscora.
 */
import type { UserRole } from "@prisma/client";
import { detectIntent, type CopilotIntentKind } from "./intent";
import { classifyScope } from "./scope";
import { runTool, type ToolContext, type ToolResult } from "./tools";
import { getFormatter, type GroundingContext } from "./llm";
import { recordAuditLog } from "../../lib/audit";
import type { SearchResult } from "../search.service";

export interface CopilotUser {
  id: number;
  name: string;
  role: UserRole;
  tenantId: number;
}

export interface CopilotProvenance {
  intent: CopilotIntentKind | "out_of_scope";
  tool: string;
  permission: string | null;
  grounded: number;
  source: "knowledge" | "database" | "navigation" | "none";
  formatter: string;
  denied: boolean;
  outOfScope: boolean;
  confidence: number;
  durationMs: number;
}

export interface CopilotResponse {
  answer: string;
  navigate?: { label: string; path: string };
  results: SearchResult[];
  provenance: CopilotProvenance;
}

const INTENT_TOOL: Record<CopilotIntentKind, string> = {
  navigate: "navigate",
  pending_approvals: "pending_approvals",
  knowledge: "knowledge",
  lookup: "search",
};

function isGrounded(result: ToolResult): boolean {
  return (
    result.results.length > 0 ||
    Boolean(result.navigate) ||
    result.data.matched === true ||
    (typeof result.data.total === "number" && result.data.total > 0)
  );
}

function sourceFor(
  intent: CopilotIntentKind,
  result: ToolResult
): CopilotProvenance["source"] {
  if (!isGrounded(result)) return "none";
  if (intent === "knowledge") return "knowledge";
  if (intent === "navigate") return "navigation";
  return "database";
}

function confidenceFor(
  intent: CopilotIntentKind,
  result: ToolResult,
  grounded: boolean
): number {
  if (!grounded) return 0.2;
  switch (intent) {
    case "navigate":
      return 0.95;
    case "pending_approvals":
      return 0.9;
    case "knowledge":
      return 0.85;
    default:
      return 0.8;
  }
}

export async function askCopilot(
  user: CopilotUser,
  message: string
): Promise<CopilotResponse> {
  const started = Date.now();
  const intent = detectIntent(message);
  const scope = classifyScope(message);

  const ctx: ToolContext = {
    role: user.role,
    userId: user.id,
    userName: user.name,
  };

  // Greetings: introduce capabilities from the knowledge base.
  const effectiveIntent: CopilotIntentKind = scope.greeting
    ? "knowledge"
    : intent.kind;
  const effectiveQuery = scope.greeting
    ? "fiscora copilot what can you do"
    : intent.query;

  const { tool, permission, result } = await runTool(
    INTENT_TOOL[effectiveIntent],
    ctx,
    effectiveQuery
  );

  // Fallbacks for a plain lookup that found nothing: try navigation, then the
  // knowledge base, so "invoices" → Invoices page, "3-way matching" → article.
  // Only for IN-SCOPE queries — an out-of-scope question must never be
  // spuriously grounded by a keyword-navigation match.
  if (
    (scope.inScope || scope.greeting) &&
    effectiveIntent === "lookup" &&
    result.results.length === 0 &&
    !result.navigate
  ) {
    const nav = await runTool("navigate", ctx, intent.query);
    if (nav.result.navigate) {
      result.navigate = nav.result.navigate;
    } else {
      const kb = await runTool("knowledge", ctx, intent.query);
      if (kb.result.data.matched === true) {
        result.data = kb.result.data;
        result.navigate = kb.result.navigate;
      }
    }
  }

  const grounded = isGrounded(result);

  // Out of scope: not a greeting, no Fiscora vocabulary, and nothing grounded.
  // We refuse deterministically — no data, no LLM guessing.
  const outOfScope = !scope.greeting && !scope.inScope && !grounded;

  const formatter = getFormatter();
  const grounding: GroundingContext = {
    question: intent.raw,
    intent: effectiveIntent,
    data: outOfScope ? {} : result.data,
    results: outOfScope
      ? []
      : result.results.map((r) => ({
          title: r.title,
          subtitle: r.subtitle,
          status: r.status,
          type: r.type,
          url: r.url,
        })),
    navigate: outOfScope ? undefined : result.navigate,
    denied: result.denied,
    outOfScope,
  };

  const answer = await formatter.format(grounding);

  const provenance: CopilotProvenance = {
    intent: outOfScope ? "out_of_scope" : effectiveIntent,
    tool: outOfScope ? "scope_guard" : tool,
    permission,
    grounded: result.results.length,
    source: outOfScope ? "none" : sourceFor(effectiveIntent, result),
    formatter: formatter.name,
    denied: Boolean(result.denied),
    outOfScope,
    confidence: outOfScope ? 0 : confidenceFor(effectiveIntent, result, grounded),
    durationMs: Date.now() - started,
  };

  // Explainability / compliance: log every interaction to the audit trail.
  // Never let logging failures affect the user's response.
  void recordAuditLog("copilot", 0, "COPILOT_QUERY", user.name, {
    actorContext: { userId: user.id, role: user.role, permission: permission ?? undefined },
    metadata: {
      prompt: message,
      intent: provenance.intent,
      tool: provenance.tool,
      source: provenance.source,
      grounded: provenance.grounded,
      formatter: provenance.formatter,
      confidence: provenance.confidence,
      outOfScope: provenance.outOfScope,
      denied: provenance.denied,
      matchedTerms: scope.matchedTerms,
      durationMs: provenance.durationMs,
      navigate: provenance.outOfScope ? null : result.navigate ?? null,
    },
  }).catch(() => {});

  return {
    answer,
    navigate: outOfScope ? undefined : result.navigate,
    results: outOfScope ? [] : result.results,
    provenance,
  };
}
