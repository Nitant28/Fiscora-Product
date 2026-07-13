"use client";

/**
 * SidebarFooter — Client component for the interactive sidebar bottom area.
 * Contains the workspace badge, collapse button, and user profile with hover effects.
 */
import { Avatar } from "@repo/ui/avatar";

type User = {
  name?: string | null;
  role?: string;
  department?: { name: string } | null;
};

export default function SidebarFooter({ user }: { user: User }) {
  return (
    <div style={{ flexShrink: 0 }}>
      {/* Collapse sidebar hint */}
      <div style={{ padding: "8px 10px 0" }}>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            background: "none",
            border: "none",
            borderRadius: "8px",
            padding: "7px 10px",
            cursor: "pointer",
            color: "#3d4a58",
            fontSize: "12px",
            fontWeight: 500,
            transition: "background 150ms ease, color 150ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLElement).style.color = "#9ba5b4";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "none";
            (e.currentTarget as HTMLElement).style.color = "#3d4a58";
          }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "14px", height: "14px", opacity: 0.6, flexShrink: 0 }}>
            <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
          </svg>
          Collapse
        </button>
      </div>

      {/* User profile */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "12px 10px 14px",
          background: "rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
          <Avatar name={user.name ?? "User"} size="md" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#e2e8f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.name}
            </p>
            <p style={{ fontSize: "10.5px", color: "#4d5a6a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.role}{user.department ? ` · ${user.department.name}` : ""}
            </p>
          </div>
          <button style={{ background: "none", border: "none", padding: "4px", cursor: "pointer", color: "#3d4a58", borderRadius: "6px", flexShrink: 0 }}>
            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "14px", height: "14px" }}>
              <path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
