/**
 * LLM formatter for the copilot — the ONLY place a language model is used.
 *
 * Hard rule: the model is a *phrasing* layer. It receives the user's question
 * plus the grounded JSON produced by approved tools, and must answer strictly
 * from that JSON. It never sees the database and is never the source of truth.
 * If no API key is configured (or the call fails), we fall back to a fully
 * deterministic formatter so the copilot always works and stays testable.
 */

export interface GroundingContext {
  question: string;
  intent: string;
  data: Record<string, unknown>;
  results: { title: string; subtitle: string; status: string; type: string; url: string }[];
  navigate?: { label: string; path: string };
  denied?: boolean;
  /** True when the question is outside Fiscora's scope → must refuse. */
  outOfScope?: boolean;
}

export const OUT_OF_SCOPE_REPLY =
  "I'm the Fiscora AI Copilot. I can only answer questions related to your Fiscora workspace, procurement workflows, and documents.";

export interface LlmFormatter {
  readonly name: string;
  format(ctx: GroundingContext): Promise<string>;
}

/* --- Deterministic formatter (no external dependency) --------------------- */
export class NullFormatter implements LlmFormatter {
  readonly name = "deterministic";

  async format(ctx: GroundingContext): Promise<string> {
    if (ctx.outOfScope) {
      return OUT_OF_SCOPE_REPLY;
    }

    if (ctx.denied) {
      return "You don't have permission to view that in Fiscora. Please contact your administrator if you need access.";
    }

    if (ctx.intent === "knowledge") {
      const article = ctx.data.article as string | undefined;
      if (!article) {
        return "I couldn't find this information inside your Fiscora workspace.";
      }
      return article;
    }

    if (ctx.intent === "navigate") {
      return ctx.navigate
        ? `Opening ${ctx.navigate.label}.`
        : "I couldn't find a matching page in Fiscora for that.";
    }

    if (ctx.intent === "pending_approvals") {
      const total = Number(ctx.data.total ?? 0);
      if (total === 0) return "You have no purchase requests pending approval right now.";
      const top = ctx.results
        .slice(0, 5)
        .map((r) => `• ${r.title} (${r.subtitle})`)
        .join("\n");
      return `You have ${total} request${total === 1 ? "" : "s"} pending approval:\n${top}`;
    }

    // lookup / search
    const total = ctx.results.length;
    if (total === 0) {
      return `I couldn't find anything in Fiscora matching "${ctx.question}".`;
    }
    const top = ctx.results
      .slice(0, 5)
      .map((r) => `• ${r.title} — ${r.subtitle} [${r.status}]`)
      .join("\n");
    return `Found ${total} result${total === 1 ? "" : "s"} in Fiscora:\n${top}`;
  }
}

/* --- Gemini formatter (optional, grounded) -------------------------------- */
const SYSTEM_INSTRUCTION = `You are the Fiscora AI Copilot for an enterprise procurement platform. You are NOT a general-purpose chatbot. You behave like Microsoft Copilot for Dynamics or Salesforce Einstein — exclusively for Fiscora.

STRICT RULES:
- Answer ONLY using the JSON grounding data provided in the user message. That grounding is your ONLY source of truth.
- NEVER use outside or general knowledge. NEVER invent numbers, names, statuses, routes, or facts.
- If the grounding is marked outOfScope=true, reply EXACTLY: "${OUT_OF_SCOPE_REPLY}" and nothing else.
- If the grounding is empty or does not contain the answer, reply: "I couldn't find this information inside your Fiscora workspace."
- Never reveal data the grounding marks as denied; instead say the user lacks permission for it.
- You may summarize, explain, rewrite, and reason over the grounding to produce clear natural language — but add no facts beyond it.
- Be concise and professional (2-5 sentences). Use the exact values from the data.
- If a navigation target is present, tell the user which page you're opening.`;

export class GeminiFormatter implements LlmFormatter {
  readonly name = "gemini";
  private fallback = new NullFormatter();

  constructor(
    private apiKey: string,
    private model = process.env.GEMINI_MODEL || "gemini-2.0-flash",
    private timeoutMs = 8000
  ) {}

  async format(ctx: GroundingContext): Promise<string> {
    // Out-of-scope never reaches the model — deterministic refusal only.
    if (ctx.outOfScope) {
      return OUT_OF_SCOPE_REPLY;
    }

    const prompt = [
      `User question: ${ctx.question}`,
      `Intent: ${ctx.intent}`,
      `Grounding data (the ONLY source of truth):`,
      "```json",
      JSON.stringify(
        {
          data: ctx.data,
          results: ctx.results.slice(0, 8),
          navigate: ctx.navigate ?? null,
          denied: ctx.denied ?? false,
        },
        null,
        2
      ),
      "```",
      "Answer the user using only this data.",
    ].join("\n");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
        }),
      });

      if (!res.ok) {
        return this.fallback.format(ctx);
      }

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text && text.length > 0 ? text : this.fallback.format(ctx);
    } catch {
      // Timeout, network error, quota — degrade gracefully.
      return this.fallback.format(ctx);
    } finally {
      clearTimeout(timer);
    }
  }
}

let cached: LlmFormatter | null = null;

/** Returns Gemini when GEMINI_API_KEY is set, else the deterministic formatter. */
export function getFormatter(): LlmFormatter {
  if (cached) return cached;
  const key = process.env.GEMINI_API_KEY;
  cached = key ? new GeminiFormatter(key) : new NullFormatter();
  return cached;
}
