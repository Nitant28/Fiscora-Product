/**
 * Scope guard — keeps the copilot strictly inside Fiscora.
 *
 * Enterprise copilots must never answer general-knowledge questions. This is a
 * deterministic allowlist classifier (the LLM is never asked "is this in
 * scope?"): a question is IN scope only if it touches Fiscora's domain
 * vocabulary (navigation keywords + knowledge-base lexicon + core procurement
 * terms) or is a recognised navigation/lookup. Everything else is refused
 * before any tool or LLM call.
 */
import { PAGE_REGISTRY } from "./navigation";
import { knowledgeLexicon } from "./knowledge";

export const OUT_OF_SCOPE_MESSAGE =
  "I'm the Fiscora AI Copilot. I can only answer questions related to your Fiscora workspace, procurement workflows, and documents.";

const GREETINGS = new Set([
  "hi", "hello", "hey", "yo", "hola", "help", "start", "greetings",
]);

/** Core procurement / product vocabulary, augmented at load time from the
 * navigation registry and knowledge base so it stays in sync automatically. */
const BASE_LEXICON = [
  "fiscora", "procurement", "procure", "invoice", "invoices", "vendor",
  "vendors", "supplier", "suppliers", "purchase", "po", "pos", "order",
  "orders", "request", "requests", "requisition", "rfq", "rfqs", "quote",
  "quotation", "bid", "bids", "grn", "goods", "receipt", "contract",
  "contracts", "payment", "payments", "approval", "approvals", "approve",
  "reject", "spend", "budget", "savings", "gst", "pan", "tax", "compliance",
  "audit", "vendor", "risk", "fraud", "duplicate", "ocr", "extraction",
  "document", "documents", "matching", "workflow", "dashboard", "analytics",
  "tenant", "rbac", "permission", "permissions", "role", "roles", "copilot",
  "catalog", "department", "departments", "billing", "subscription", "onboarding",
];

function buildLexicon(): Set<string> {
  const lex = knowledgeLexicon();
  for (const t of BASE_LEXICON) lex.add(t);
  for (const p of PAGE_REGISTRY) {
    for (const kw of p.keywords) {
      for (const t of kw.toLowerCase().split(/\s+/)) {
        if (t.length > 1) lex.add(t);
      }
    }
    for (const t of p.label.toLowerCase().split(/\s+/)) {
      if (t.length > 1) lex.add(t);
    }
  }
  return lex;
}

let LEXICON: Set<string> | null = null;

export interface ScopeResult {
  inScope: boolean;
  greeting: boolean;
  matchedTerms: string[];
}

export function classifyScope(message: string): ScopeResult {
  if (!LEXICON) LEXICON = buildLexicon();

  const raw = message.toLowerCase().trim();
  const tokens = raw.match(/[a-z0-9]+/g) ?? [];

  if (tokens.length > 0 && tokens.every((t) => GREETINGS.has(t))) {
    return { inScope: true, greeting: true, matchedTerms: [] };
  }

  const matched = tokens.filter((t) => LEXICON!.has(t));
  return {
    inScope: matched.length > 0,
    greeting: false,
    matchedTerms: [...new Set(matched)],
  };
}
