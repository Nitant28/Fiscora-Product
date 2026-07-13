"use client";

/**
 * Fiscora AI Copilot (grounded).
 *
 * A conversational assistant that answers ONLY from Fiscora's own data via the
 * RBAC-scoped /copilot/ask endpoint, and can navigate the app deterministically.
 * The language model (Gemini, when configured server-side) only phrases the
 * grounded result — it never invents answers. Every reply shows its provenance
 * (tool, grounded count, formatter, latency) for enterprise explainability.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Provenance = {
  intent: string;
  tool: string;
  permission: string | null;
  grounded: number;
  formatter: string;
  denied: boolean;
  durationMs: number;
};

type ResultHit = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  status: string;
  url: string;
};

type Turn = {
  role: "user" | "assistant";
  text: string;
  navigate?: { label: string; path: string } | null;
  results?: ResultHit[];
  provenance?: Provenance;
};

const SUGGESTIONS = [
  "What needs my approval?",
  "Take me to vendor approvals",
  "Open purchase orders",
  "Find contract renewals",
];

export default function Copilot() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, busy]);

  const goto = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  const ask = useCallback(
    async (message: string) => {
      const q = message.trim();
      if (!q || busy) return;
      setTurns((t) => [...t, { role: "user", text: q }]);
      setInput("");
      setBusy(true);
      try {
        const res = await fetch("/api/proxy/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q }),
          cache: "no-store",
        });
        const data = await res.json();
        if (data.success) {
          setTurns((t) => [
            ...t,
            {
              role: "assistant",
              text: data.answer,
              navigate: data.navigate ?? null,
              results: (data.results ?? []).slice(0, 6),
              provenance: data.provenance,
            },
          ]);
        } else {
          setTurns((t) => [
            ...t,
            {
              role: "assistant",
              text:
                data.error ??
                "Something went wrong. Please try again in a moment.",
            },
          ]);
        }
      } catch {
        setTurns((t) => [
          ...t,
          { role: "assistant", text: "I couldn't reach Fiscora just now." },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Fiscora AI Copilot (Ctrl+J)"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          border: "1px solid #dcd6ff",
          background: "linear-gradient(180deg,#f5f3ff,#eef2ff)",
          borderRadius: "8px",
          padding: "6px 12px",
          cursor: "pointer",
          color: "#4338ca",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
          <path d="M10 1.5l1.9 4.3 4.6.4-3.5 3 1.1 4.5L10 11.9 5.4 13.7l1.1-4.5-3.5-3 4.6-.4L10 1.5z" />
        </svg>
        Ask AI
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(15,17,23,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "440px",
              height: "100%",
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-16px 0 48px rgba(15,23,42,0.18)",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 18px",
                borderBottom: "1px solid #f0f3f7",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "linear-gradient(135deg,#6366f1,#4338ca)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
                    <path d="M10 1.5l1.9 4.3 4.6.4-3.5 3 1.1 4.5L10 11.9 5.4 13.7l1.1-4.5-3.5-3 4.6-.4L10 1.5z" />
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0b1220" }}>
                    Fiscora Copilot
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Answers only from your Fiscora data
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#94a3b8",
                  fontSize: 18,
                }}
              >
                ✕
              </button>
            </div>

            {/* Conversation */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {turns.length === 0 && (
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  <p style={{ marginTop: 0 }}>
                    Ask about approvals, vendors, invoices, or say “take me to…”.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        style={{
                          textAlign: "left",
                          border: "1px solid #e8ecf0",
                          background: "#f8fafc",
                          borderRadius: 8,
                          padding: "8px 12px",
                          cursor: "pointer",
                          fontSize: 13,
                          color: "#334155",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {turns.map((t, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  {t.role === "user" ? (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div
                        style={{
                          background: "#4338ca",
                          color: "#fff",
                          borderRadius: "12px 12px 2px 12px",
                          padding: "8px 12px",
                          fontSize: 13,
                          maxWidth: "85%",
                        }}
                      >
                        {t.text}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          background: "#f1f5f9",
                          color: "#0b1220",
                          borderRadius: "12px 12px 12px 2px",
                          padding: "10px 12px",
                          fontSize: 13,
                          whiteSpace: "pre-wrap",
                          maxWidth: "92%",
                        }}
                      >
                        {t.text}
                      </div>

                      {t.navigate && (
                        <button
                          onClick={() => goto(t.navigate!.path)}
                          style={{
                            marginTop: 8,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            border: "1px solid #c7d2fe",
                            background: "#eef2ff",
                            color: "#4338ca",
                            borderRadius: 8,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Go to {t.navigate.label} →
                        </button>
                      )}

                      {t.results && t.results.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                          {t.results.map((r) => (
                            <button
                              key={`${r.type}-${r.id}`}
                              onClick={() => goto(r.url)}
                              style={{
                                textAlign: "left",
                                border: "1px solid #e8ecf0",
                                background: "#fff",
                                borderRadius: 8,
                                padding: "8px 10px",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0b1220" }}>
                                {r.title}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>
                                {r.subtitle} · {r.status}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {t.provenance && (
                        <div style={{ marginTop: 6, fontSize: 10.5, color: "#94a3b8" }}>
                          via {t.provenance.tool} · {t.provenance.grounded} grounded ·{" "}
                          {t.provenance.formatter} · {t.provenance.durationMs}ms
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {busy && (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Thinking…</div>
              )}
            </div>

            {/* Input */}
            <div style={{ borderTop: "1px solid #f0f3f7", padding: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") ask(input);
                  }}
                  placeholder="Ask Fiscora…"
                  style={{
                    flex: 1,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={() => ask(input)}
                  disabled={busy || !input.trim()}
                  style={{
                    border: "none",
                    background: busy || !input.trim() ? "#c7d2fe" : "#4338ca",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "0 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: busy || !input.trim() ? "default" : "pointer",
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
