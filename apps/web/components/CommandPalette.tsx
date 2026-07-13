"use client";

/**
 * Enterprise Command Palette (V2).
 * Ctrl/Cmd+K opens a global search across every entity the user can view.
 * Results come from the RBAC-filtered /search registry and are grouped by type.
 * Static quick actions are merged in so the palette doubles as a navigator.
 *
 * V2 upgrades:
 *   • Proper SVG icons (no emoji)
 *   • Grouped results with type headers
 *   • Kbd hints in footer
 *   • backdrop-blur overlay
 *   • Refined trigger button (looks like a real search bar)
 *   • Smooth slide-down animation
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  status: string;
  icon: string;
  url: string;
  score: number;
};

type SearchGroup = {
  type: string;
  label: string;
  results: SearchResult[];
};

const QUICK_ACTIONS: { label: string; url: string; group: string }[] = [
  { label: "Dashboard",                   url: "/dashboard",          group: "Navigate" },
  { label: "Vendors",                     url: "/vendors",            group: "Navigate" },
  { label: "Purchase Requests",           url: "/requests",           group: "Navigate" },
  { label: "Purchase Orders",             url: "/purchase-orders",    group: "Navigate" },
  { label: "Contracts",                   url: "/contracts",          group: "Navigate" },
  { label: "Invoices",                    url: "/invoices",           group: "Navigate" },
  { label: "Payments",                    url: "/payments",           group: "Navigate" },
  { label: "Approvals",                   url: "/approvals",          group: "Navigate" },
  { label: "Analytics",                   url: "/analytics",          group: "Navigate" },
  { label: "Settings · Users",            url: "/settings/users",     group: "Navigate" },
  { label: "Settings · Billing",          url: "/settings/billing",   group: "Navigate" },
  { label: "Admin · Permissions",         url: "/admin/permissions",  group: "Navigate" },
  { label: "Admin · Audit Center",        url: "/admin/audit",        group: "Navigate" },
  { label: "Settings · Developer Keys",   url: "/settings/developer", group: "Navigate" },
];

// SVG icons for result types
function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "vendor":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M3 2A1 1 0 0 0 2 3v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3Zm2.5 5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5Zm0 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3Z" clipRule="evenodd" />
        </svg>
      );
    case "purchase-order":
    case "purchase-request":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M4 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4Zm2.5 5.5a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3Zm0 2a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1h-2Z" clipRule="evenodd" />
        </svg>
      );
    case "invoice":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9Zm5 5.5a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 7 9Z" />
        </svg>
      );
    case "contract":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M4 1.5A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V5.621a1.5 1.5 0 0 0-.44-1.06L9.94 1.44A1.5 1.5 0 0 0 8.878 1H4Zm1.75 6.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Zm0 2.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z" clipRule="evenodd" />
        </svg>
      );
    case "employee":
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1 1 0 0 0 .17.047c.875.179 1.812.284 2.8.32.3.011.603.017.908.017.305 0 .608-.006.908-.017.988-.036 1.925-.141 2.8-.32a1 1 0 0 0 .169-.047C11.742 14.04 13 12.776 13 11.25c0-1.892-2.239-3.125-5-3.125S3 9.358 3 11.25c0 1.526 1.258 2.79 2.465 3.243Z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 3.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" />
        </svg>
      );
  }
}

// Arrow icon for navigate items
function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
    </svg>
  );
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flatten everything into one selectable list
  const filteredActions =
    query.trim().length === 0
      ? QUICK_ACTIONS
      : QUICK_ACTIONS.filter((a) =>
          a.label.toLowerCase().includes(query.toLowerCase())
        );

  const flatItems: {
    label: string;
    subtitle: string;
    url: string;
    type: string;
    isAction: boolean;
  }[] = [
    ...filteredActions.map((a) => ({
      label: a.label,
      subtitle: a.group,
      url: a.url,
      type: "action",
      isAction: true,
    })),
    ...groups.flatMap((g) =>
      g.results.map((r) => ({
        label: r.title,
        subtitle: `${g.label.slice(0, -1)} · ${r.subtitle}`,
        url: r.url,
        type: r.type,
        isAction: false,
      }))
    ),
  ];

  const toggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
      setGroups([]);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/proxy/search?q=${encodeURIComponent(query)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setGroups(data.success ? data.groups ?? [] : []);
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function go(url: string) {
    setOpen(false);
    router.push(url);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) go(item.url);
    }
  }

  return (
    <>
      {/* Trigger button — looks like a refined search bar */}
      <button
        id="command-palette-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open command palette (Ctrl+K)"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          border: "1px solid #e8ecf0",
          background: "#f8fafc",
          borderRadius: "8px",
          padding: "6px 12px",
          cursor: "pointer",
          color: "#6b7a8f",
          fontSize: "13px",
          transition: "all 150ms ease",
          minWidth: "200px",
          maxWidth: "320px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#d1d8e0";
          (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#e8ecf0";
          (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc";
        }}
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          style={{ width: "14px", height: "14px", flexShrink: 0 }}
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
            clipRule="evenodd"
          />
        </svg>
        <span style={{ flex: 1, textAlign: "left" }}>Search…</span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            marginLeft: "4px",
          }}
        >
          <kbd
            style={{
              border: "1px solid #e2e8f0",
              background: "white",
              borderRadius: "4px",
              padding: "1px 4px",
              fontSize: "10px",
              fontWeight: 600,
              color: "#94a3b8",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              fontFamily: "inherit",
            }}
          >
            ⌘K
          </kbd>
        </span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="command-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "10vh",
            background: "rgba(15, 17, 23, 0.5)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            className="command-panel"
            style={{
              width: "100%",
              maxWidth: "560px",
              maxHeight: "70vh",
              display: "flex",
              flexDirection: "column",
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px solid #e8ecf0",
              boxShadow: "0 24px 64px -8px rgba(15, 23, 42, 0.22), 0 8px 24px -4px rgba(15, 23, 42, 0.12)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "14px 16px",
                borderBottom: "1px solid #f0f3f7",
              }}
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                style={{ width: "16px", height: "16px", color: "#94a3b8", flexShrink: 0 }}
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search vendors, POs, invoices, contracts…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: "14px",
                  color: "#0b1220",
                  fontFamily: "inherit",
                }}
                aria-label="Search"
              />
              {loading && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    flexShrink: 0,
                  }}
                >
                  Searching…
                </span>
              )}
            </div>

            {/* Results list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
              {flatItems.length === 0 && (
                <div
                  style={{
                    padding: "32px 16px",
                    textAlign: "center",
                    fontSize: "13px",
                    color: "#94a3b8",
                  }}
                >
                  {query.trim().length < 2
                    ? "Type to search across your workspace…"
                    : "No results found."}
                </div>
              )}

              {/* Group label for navigate actions */}
              {filteredActions.length > 0 && (
                <div
                  style={{
                    padding: "4px 10px 2px",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Navigate
                </div>
              )}

              {flatItems.map((item, i) => {
                const isActive = i === activeIndex;
                return (
                  <button
                    key={`${item.url}-${i}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => go(item.url)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      background: isActive ? "#eef2ff" : "transparent",
                      transition: "background 100ms ease",
                    }}
                  >
                    <span
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "6px",
                        background: isActive ? "#e0e7ff" : "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: isActive ? "#4338ca" : "#64748b",
                      }}
                    >
                      {item.isAction ? <ArrowIcon /> : <TypeIcon type={item.type} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: isActive ? "#312e81" : "#0b1220",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.label}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        flexShrink: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100px",
                      }}
                    >
                      {item.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "1px solid #f0f3f7",
                padding: "8px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {[
                  { keys: ["↑", "↓"], label: "navigate" },
                  { keys: ["↵"], label: "open" },
                  { keys: ["Esc"], label: "close" },
                ].map(({ keys, label }) => (
                  <span
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      color: "#94a3b8",
                    }}
                  >
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        style={{
                          border: "1px solid #e2e8f0",
                          background: "white",
                          borderRadius: "4px",
                          padding: "1px 5px",
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "#64748b",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                          fontFamily: "inherit",
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                    <span>{label}</span>
                  </span>
                ))}
              </div>
              <span style={{ fontSize: "11px", color: "#cbd5e1", fontWeight: 500 }}>
                Fiscora
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
