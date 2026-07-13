/**
 * RootLayout
 * Purpose: App shell with RBAC nav, server-side auth guard, and header.
 * Auth: Clerk is the sole gate. Fiscora user must resolve via /auth/me.
 *   Unprovisioned Clerk accounts see /account-not-provisioned — never a limited dashboard.
 *
 * V3: Enterprise Command Center — workspace badge, rich top header, premium user profile.
 */
import "./globals.css";
import { Inter } from "next/font/google";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { Avatar } from "@repo/ui/avatar";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { apiFetch, getAuthState } from "../lib/api";
import {
  canAccessRoute,
  hasPermission,
  visibleNavGroups,
  PERMISSION_KEYS,
} from "../lib/permissions";
import NotificationBell from "../components/NotificationBell";
import DevAccountMenu from "../components/DevAccountMenu";
import CommandPalette from "../components/CommandPalette";
import Copilot from "../components/Copilot";
import Sidebar from "../components/Sidebar";
import SidebarFooter from "../components/SidebarFooter";
import { isDevAuthEnabled } from "../lib/devAuth";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/legacy-login",
  "/clerk-test",
  "/dev-login",
];

const PROVISIONING_PATH = "/account-not-provisioned";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

function isPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") {
    return true;
  }
  if (
    PUBLIC_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )
  ) {
    return true;
  }
  if (
    pathname.startsWith("/vendor-onboarding/") &&
    !pathname.startsWith("/vendor-onboarding/admin")
  ) {
    return true;
  }
  return false;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authState = await getAuthState();
  const headersList = await headers();
  const pathname =
    headersList.get("x-pathname") ??
    headersList.get("x-invoke-path") ??
    headersList.get("x-url") ??
    "";

  const publicPath = isPublicPath(pathname);
  const user =
    authState.status === "authenticated"
      ? authState.user
      : null;
  const isDevSession =
    authState.status === "authenticated" &&
    authState.isDevSession;

  // Clerk session exists but no Fiscora user — provisioning error, not a fallback role.
  if (authState.status === "not_provisioned") {
    const devEscape =
      isDevAuthEnabled() && pathname.startsWith("/dev-login");
    if (pathname !== PROVISIONING_PATH && !devEscape) {
      redirect(PROVISIONING_PATH);
    }
    return (
      <html lang="en" className={inter.className}>
        <body style={{ background: "#f4f6f9" }}>
          <ClerkProvider afterSignOutUrl="/login">
            {children}
          </ClerkProvider>
        </body>
      </html>
    );
  }

  if (
    user &&
    (pathname.startsWith("/login") || pathname.startsWith("/signup"))
  ) {
    redirect("/dashboard");
  }

  if (
    authState.status === "unauthenticated" &&
    pathname &&
    !publicPath
  ) {
    redirect("/login");
  }

  if (publicPath || !user) {
    return (
      <html lang="en" className={inter.className}>
        <body style={{ background: "#f4f6f9" }}>
          <ClerkProvider afterSignOutUrl="/login">
            {children}
          </ClerkProvider>
        </body>
      </html>
    );
  }

  if (
    pathname &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/import") &&
    hasPermission(user, PERMISSION_KEYS.USER_MANAGE)
  ) {
    const onboardingRes = await apiFetch("/onboarding/status");
    if (onboardingRes.ok) {
      const onboarding = await onboardingRes.json();
      if (
        onboarding.tenant &&
        onboarding.tenant.onboardingComplete === false
      ) {
        redirect("/onboarding");
      }
    }
  }

  if (pathname && !canAccessRoute(pathname, user)) {
    redirect("/dashboard");
  }

  let unreadCount = 0;
  const notifRes = await apiFetch("/notifications");
  if (notifRes.ok) {
    const data = await notifRes.json();
    unreadCount = data.unreadCount ?? 0;
  }

  const navGroups = visibleNavGroups(user);

  return (
    <html lang="en" className={inter.className}>
      <body style={{ background: "#f0f2f5" }}>
        <ClerkProvider afterSignOutUrl="/login">
          <div className="flex min-h-screen">

            {/* ── SIDEBAR — Enterprise Command Center ─────── */}
            <aside
              style={{
                width: "256px",
                flexShrink: 0,
                background: "#0d1117",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                flexDirection: "column",
                position: "sticky",
                top: 0,
                height: "100vh",
                overflow: "hidden",
              }}
            >
              {/* Logo + Workspace Badge */}
              <div style={{ padding: "18px 16px 0", flexShrink: 0 }}>
                {/* Brand */}
                <Link
                  href="/"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    textDecoration: "none",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "9px",
                      background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 2px 8px rgba(99,102,241,0.4)",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 4C2 2.895 2.895 2 4 2h8c1.105 0 2 .895 2 2v1H2V4z" fill="white" fillOpacity="0.95" />
                      <rect x="2" y="7" width="12" height="2" rx="1" fill="white" fillOpacity="0.75" />
                      <rect x="2" y="11" width="7" height="2" rx="1" fill="white" fillOpacity="0.55" />
                    </svg>
                  </div>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.02em" }}>
                    Fiscora
                  </span>
                </Link>

                {/* Workspace / Org Badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    padding: "9px 11px",
                    marginBottom: "18px",
                    cursor: "default",
                  }}
                >
                  <div
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "7px",
                      background: "linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#fff",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {(user.department?.name ?? user.name ?? "A").slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: "11.5px", fontWeight: 600, color: "#e2e8f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.department?.name ?? "Acme Corporation"}
                    </p>
                    <p style={{ fontSize: "10px", color: "#4d5a6a", margin: 0 }}>Enterprise Plan</p>
                  </div>
                  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "12px", height: "12px", color: "#4d5a6a", flexShrink: 0 }}>
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Nav — scrollable */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "0 10px",
                  scrollbarWidth: "none",
                }}
              >
                <Sidebar groups={navGroups} />
                <SidebarFooter user={user} />
              </div>
            </aside>

            {/* ── MAIN CONTENT AREA ────────────────────────── */}
            <main className="flex flex-1 flex-col min-w-0">

              {/* Enterprise Header */}
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  borderBottom: "1px solid #e4e8ed",
                  background: "#ffffff",
                  padding: "0 28px",
                  height: "56px",
                  flexShrink: 0,
                  position: "sticky",
                  top: 0,
                  zIndex: 40,
                  boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                }}
              >
                {/* Search */}
                <div style={{ flex: 1, maxWidth: "420px" }}>
                  <CommandPalette />
                </div>

                {/* Right actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {/* AI Copilot */}
                  <Copilot />

                  {/* Divider */}
                  <div style={{ width: "1px", height: "20px", background: "#e8ecf0", margin: "0 4px" }} />

                  {/* Help */}
                  <button
                    title="Help & Documentation"
                    className="flex items-center justify-center w-[34px] h-[34px] rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer bg-transparent border-none"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "16px", height: "16px" }}>
                      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Divider */}
                  <div style={{ width: "1px", height: "20px", background: "#e8ecf0", margin: "0 4px" }} />

                  {/* Notifications */}
                  <NotificationBell initialUnreadCount={unreadCount} />

                  {/* Divider */}
                  <div style={{ width: "1px", height: "20px", background: "#e8ecf0", margin: "0 4px" }} />

                  {/* User Profile Button */}
                  {isDevSession ? (
                    <DevAccountMenu
                      name={user.name ?? "Demo User"}
                      role={user.role}
                    />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <UserButton />
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", lineHeight: 1.2 }}>
                          {user.name?.split(" ")[0] ?? "User"}
                        </span>
                        <span style={{ fontSize: "10.5px", color: "#64748b", lineHeight: 1.2 }}>
                          {user.role}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </header>

              {/* Page content */}
              <div className="flex-1">{children}</div>
            </main>
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
