# Fiscora AI Copilot

A **grounded, RBAC-scoped, explainable, knowledge-first** in-product assistant.
It answers **only** from Fiscora's own data and knowledge base, can navigate the
app, and **refuses anything outside Fiscora**. A language model (Gemini,
optional) is used **only to phrase** already-grounded results — never as the
source of truth.

## Why this design

Most SaaS copilots let the LLM answer from general knowledge or query the DB
directly. That leaks data, hallucinates facts, answers off-topic questions, and
fails enterprise audits. Fiscora's copilot inverts this:

```
user message
   → detectIntent            (deterministic rules — intent.ts)
   → classifyScope           (Fiscora-only allowlist — scope.ts)
        └── out of scope? → deterministic refusal, no tool, no LLM
   → approved tool           (RBAC + tenant-scoped — tools.ts)
        ├── knowledge         (internal knowledge base — knowledge.ts)
        ├── navigate          (deterministic page registry — navigation.ts)
        ├── search            (RBAC-filtered enterprise search)
        └── pending_approvals (SUBMITTED requests, permission-gated)
   → grounded JSON           (the ONLY source of truth)
   → LLM phrases it          (Gemini optional — llm.ts; else deterministic)
   → answer + navigation + provenance + audit log
```

The LLM never touches PostgreSQL. It can only trigger approved tools, each of
which is permission-gated (`hasPermission`) and tenant-scoped (extended Prisma
client). This makes the copilot impossible to jailbreak into cross-tenant leaks
or general-knowledge answers.

## Source-of-truth priority

1. Organization database (via tenant-scoped, permission-gated tools)
2. Current user's permissions & application state (RBAC + navigation registry)
3. Fiscora internal **knowledge base** (`knowledge.ts` — pages, workflows,
   features, procurement concepts, AI modules)
4. LLM (Gemini) — **phrasing/reasoning only**, over the grounded data above

If nothing grounds an in-scope question → *"I couldn't find this information
inside your Fiscora workspace."* If the question is out of scope → the fixed
refusal. Gemini never invents an answer.

## Scope guard (`scope.ts`)

A deterministic allowlist keeps the copilot strictly on Fiscora. A message is
**in scope** only if it touches Fiscora's domain vocabulary — built at load time
from the navigation keywords + knowledge-base lexicon + core procurement terms —
or resolves to real data/knowledge. General-knowledge questions ("Who is Elon
Musk?", "Write a poem") match nothing and are refused **before any tool or LLM
call** with:

> I'm the Fiscora AI Copilot. I can only answer questions related to your
> Fiscora workspace, procurement workflows, and documents.

Greetings ("hi", "help") return a capability summary from the knowledge base.

## Knowledge base (`knowledge.ts`) — RAG-ready

Each article is a self-contained chunk: `{ id, title, route?, category,
summary, body, keywords }`. `searchKnowledge()` is a deterministic keyword
ranker today; because articles are already chunked with grounding `body` text,
a future `indexer.ts`/`embeddings.ts` can add vector search by swapping only
that function — the engine and tools are untouched. This is the "Knowledge
Service" seam: documentation, contracts, and customer policies can be indexed
later without redesigning the copilot.

## Explainability & audit

Every response carries `provenance`, and every interaction is written to the
immutable `AuditLog` (`entityType="copilot"`, `action="COPILOT_QUERY"`) with the
prompt, intent, tool, source, grounded count, formatter, confidence, scope, and
latency — so each answer is fully traceable.

```json
{
  "intent": "knowledge",
  "tool": "knowledge",
  "permission": null,
  "grounded": 0,
  "source": "knowledge",
  "formatter": "gemini",
  "denied": false,
  "outOfScope": false,
  "confidence": 0.85,
  "durationMs": 161
}
```

## Gemini (optional, free tier)

- Unset key → deterministic formatter (fully functional, used in tests/CI).
- Set `GEMINI_API_KEY` (+ optional `GEMINI_MODEL`, default `gemini-2.0-flash`)
  → Gemini phrases the grounded JSON under a strict system instruction that
  forbids outside knowledge, forbids invented facts, and emits the exact refusal
  for out-of-scope. Out-of-scope never reaches the model. On any error/timeout
  it falls back to the deterministic formatter, so the copilot never hard-fails.

## Endpoints

| Method | Path             | Auth | Purpose                                        |
| ------ | ---------------- | ---- | ---------------------------------------------- |
| POST   | `/copilot/ask`   | ✅   | `{ message }` → grounded answer + navigation   |
| GET    | `/copilot/pages` | ✅   | Pages the current role may be navigated to     |

## Files

| File                 | Responsibility                                            |
| -------------------- | --------------------------------------------------------- |
| `scope.ts`           | Fiscora-only allowlist classifier + refusal message       |
| `knowledge.ts`       | Internal knowledge base + `searchKnowledge` (RAG-ready)   |
| `navigation.ts`      | Page registry + deterministic, RBAC-filtered nav resolver |
| `intent.ts`          | Rule-based intent classification + query cleaning         |
| `tools.ts`           | Approved, permission-gated, tenant-scoped tools           |
| `llm.ts`             | `LlmFormatter`, `NullFormatter`, `GeminiFormatter`        |
| `copilot.service.ts` | Orchestrates scope → intent → tool → grounding → answer   |

## Testing

```bash
pnpm --filter api exec tsx scripts/testCopilot.ts
```

Runs the deterministic layer (scope + intent + nav, no DB) plus per-role
questions against the seeded DB, printing answers, navigation targets, and
provenance. Verifies: roles without a permission are silently denied
data/pages; knowledge questions answer from the KB; and out-of-scope questions
are refused with `tool=scope_guard`.

## Extending

- **Add knowledge**: append a `KnowledgeArticle` to `KNOWLEDGE_BASE`. Its
  keywords automatically extend the scope lexicon.
- **Add a tool**: implement `CopilotTool` in `tools.ts`, register in `TOOLS`,
  map an intent to it in `copilot.service.ts`.
- **Add a page**: append to `PAGE_REGISTRY` with keywords + required permission.
  No route/LLM changes needed.
- **Add RAG later**: replace the body of `searchKnowledge` with a vector search;
  nothing else changes.
