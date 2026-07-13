/**
 * Deterministic intent router for the copilot.
 *
 * Classifies a user message into a small, fixed set of intents and extracts a
 * clean query. This is rule-based (not the LLM) so behaviour is predictable,
 * auditable, and cheap. The LLM is only used later to phrase the grounded result.
 */

export type CopilotIntentKind =
  | "navigate"
  | "pending_approvals"
  | "knowledge"
  | "lookup";

export interface CopilotIntent {
  kind: CopilotIntentKind;
  /** Cleaned query text used by the resolved tool. */
  query: string;
  /** The original raw message. */
  raw: string;
}

const NAV_TRIGGERS = [
  "take me to",
  "go to",
  "open ",
  "navigate to",
  "show me the",
  "bring up",
  "where is the",
  "where do i",
  "where can i",
  "jump to",
];

// "How / what / why / explain" style questions → answer from the knowledge base.
const KNOWLEDGE_TRIGGERS = [
  "how do i",
  "how to",
  "how does",
  "how can i",
  "what is",
  "what are",
  "what's",
  "explain",
  "why does",
  "why is",
  "tell me about",
  "walk me through",
  "guide",
];

const APPROVAL_TRIGGERS = [
  "pending approval",
  "pending approvals",
  "needs my approval",
  "need my approval",
  "waiting for approval",
  "awaiting approval",
  "to approve",
  "what should i approve",
  "requests to approve",
  "approvals pending",
];

const FILLER = [
  "please",
  "can you",
  "could you",
  "i want to",
  "i need to",
  "kindly",
  "for me",
  "the page",
  "page for",
  "search for",
  "look up",
  "lookup",
  "show me",
  "find me",
  "find ",
  "search ",
  "show ",
  "list ",
  "display ",
  "fetch ",
];

function stripPrefixes(message: string, triggers: string[]): string {
  let out = message;
  for (const t of triggers) {
    const idx = out.toLowerCase().indexOf(t);
    if (idx !== -1) {
      out = out.slice(idx + t.length);
      break;
    }
  }
  return out.trim();
}

function clean(message: string): string {
  let out = ` ${message.toLowerCase()} `;
  for (const f of FILLER) {
    out = out.split(f).join(" ");
  }
  return out.replace(/\s+/g, " ").trim();
}

export function detectIntent(rawMessage: string): CopilotIntent {
  const raw = (rawMessage ?? "").trim();
  const lower = raw.toLowerCase();

  if (APPROVAL_TRIGGERS.some((t) => lower.includes(t))) {
    return { kind: "pending_approvals", query: "", raw };
  }

  if (NAV_TRIGGERS.some((t) => lower.includes(t))) {
    return {
      kind: "navigate",
      query: clean(stripPrefixes(raw, NAV_TRIGGERS)) || clean(raw),
      raw,
    };
  }

  if (KNOWLEDGE_TRIGGERS.some((t) => lower.includes(t))) {
    return { kind: "knowledge", query: clean(raw), raw };
  }

  // Default: a grounded lookup against Fiscora's data.
  return { kind: "lookup", query: clean(raw), raw };
}
