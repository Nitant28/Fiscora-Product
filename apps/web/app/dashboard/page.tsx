/**
 * Executive Dashboard — Enterprise Command Center
 * Purpose: CFO/Director/Procurement morning view with full visual hierarchy.
 * Matches reference design: greeting, 6 KPI cards with sparklines, spend trend,
 * category donut, top vendors, pending approvals, budget utilization, activity feed, AI insight bar.
 * Data: GET /analytics/executive, GET /analytics/vendor-risk
 */
import Link from "next/link";
import { EmptyState } from "@repo/ui/empty-state";
import { ErrorState } from "@repo/ui/states";
import { cn } from "@repo/ui/cn";
import { formatMoney } from "../../lib/metrics";
import type { ExecutiveAnalyticsResponse } from "../../lib/analytics-types";
import { apiFetch, getCurrentUser } from "../../lib/api";
import {
  hasPermission,
  PERMISSION_KEYS,
  canViewExecutiveDashboard,
} from "../../lib/permissions";

type VendorRiskApiResponse = {
  success: boolean;
  vendors?: { name: string; spend: number; share: number; risk: string }[];
  exposure?: { critical: number; high: number; medium: number; low: number };
};

async function getExecutive(): Promise<{
  data: ExecutiveAnalyticsResponse["data"] | null;
  forbidden: boolean;
}> {
  const res = await apiFetch("/analytics/executive");
  if (res.status === 403) return { data: null, forbidden: true };
  if (!res.ok) return { data: null, forbidden: false };

  const executive = (await res.json()) as ExecutiveAnalyticsResponse;
  const data = executive?.data ?? null;

  if (data && (!data.vendorRiskExposure || !data.topVendorDependency)) {
    const riskRes = await apiFetch("/analytics/vendor-risk");
    if (riskRes.ok) {
      const riskJson = (await riskRes.json()) as VendorRiskApiResponse;
      if (riskJson.exposure) data.vendorRiskExposure = riskJson.exposure;
      if (!data.topVendorDependency && riskJson.vendors?.length) {
        const top = riskJson.vendors.find((v) => v.risk === "CRITICAL" || v.risk === "HIGH") ?? riskJson.vendors[0];
        if (top) data.topVendorDependency = { name: top.name, spend: top.spend, share: top.share, risk: top.risk };
      }
    }
  }
  return { data, forbidden: false };
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Minimal sparkline SVG — 20 data points, 64×24px
function Sparkline({ data, color, fill }: { data: number[]; color: string; fill?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const W = 80; const H = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(" ");
  const area = `0,${H} ${polyline} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "80px", height: "28px", overflow: "visible" }}>
      {fill && <polygon points={area} fill={fill} opacity="0.12" />}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Priority Badge
function PriorityBadge({ priority }: { priority: string }) {
  const p = (priority ?? "").toLowerCase();
  const styles: Record<string, { bg: string; color: string; dot: string }> = {
    high:   { bg: "#fef2f2", color: "#991b1b", dot: "#ef4444" },
    medium: { bg: "#fffbeb", color: "#92400e", dot: "#f59e0b" },
    low:    { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e" },
    critical: { bg: "#fef2f2", color: "#7f1d1d", dot: "#dc2626" },
  };
  const s = styles[p] ?? { bg: "#fffbeb", color: "#92400e", dot: "#f59e0b" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "9999px", background: s.bg, fontSize: "11px", fontWeight: 600, color: s.color }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase()}
    </span>
  );
}

// Section header
function SectionHeader({ title, href, hrefLabel = "View all" }: { title: string; href?: string; hrefLabel?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
      <h3 style={{ fontSize: "13.5px", fontWeight: 600, color: "#0b1220", margin: 0, letterSpacing: "-0.01em" }}>{title}</h3>
      {href && (
        <Link href={href} style={{ fontSize: "11.5px", color: "#4f46e5", fontWeight: 500, textDecoration: "none" }}>
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}

// Period selector (visual only)
function PeriodSelector({ label = "This Month" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", border: "1px solid #e8ecf0", borderRadius: "8px", fontSize: "11.5px", color: "#44546a", fontWeight: 500, cursor: "default", background: "#fff", userSelect: "none" }}>
      <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "13px", height: "13px", opacity: 0.6 }}>
        <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Z" clipRule="evenodd" />
      </svg>
      {label}
      <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "11px", height: "11px", opacity: 0.5 }}>
        <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

// Card shell
function DashCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e8ecf0",
      borderRadius: "14px",
      padding: "18px 20px",
      boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.03)",
      ...style
    }}>
      {children}
    </div>
  );
}

// KPI card with sparkline matching reference
function KpiCard({
  label, value, subLabel, delta, deltaDir, sparkData, sparkColor, sparkFill, href,
}: {
  label: string; value: string; subLabel?: string;
  delta?: string; deltaDir?: "up" | "down" | "flat";
  sparkData?: number[]; sparkColor?: string; sparkFill?: string;
  href?: string;
}) {
  const deltaColors = { up: "#15803d", down: "#dc2626", flat: "#64748b" };
  const deltaColor = deltaDir ? deltaColors[deltaDir] : "#64748b";
  const deltaIcon = deltaDir === "up" ? "▲" : deltaDir === "down" ? "▼" : "→";

  const content = (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      className={cn(
        "bg-white border border-[#e8ecf0] rounded-[14px] p-[16px_18px_14px] shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-150 overflow-hidden",
        href ? "cursor-pointer hover:shadow-[0_4px_16px_rgba(15,23,42,0.10)] hover:-translate-y-[1px]" : "cursor-default"
      )}
    >
      <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0, minHeight: "28px", lineHeight: 1.25 }}>{label}</p>
      <p style={{ fontSize: "24px", fontWeight: 700, color: "#0b1220", letterSpacing: "-0.03em", margin: "0 0 6px", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</p>
      {(delta || subLabel) && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {delta && deltaDir && (
            <span style={{ fontSize: "11.5px", fontWeight: 600, color: deltaColor }}>
              {deltaIcon} {delta}
            </span>
          )}
          {subLabel && (
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>{subLabel}</span>
          )}
        </div>
      )}
      <div style={{ marginTop: "auto", paddingTop: "10px", height: "38px" }}>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} color={sparkColor ?? "#6366f1"} fill={sparkFill} />
        )}
      </div>
    </div>
  );

  if (href) return <Link href={href} style={{ display: "block", height: "100%", textDecoration: "none" }}>{content}</Link>;
  return content;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const { data, forbidden } = await getExecutive();
  const canViewExecutive = canViewExecutiveDashboard(user);
  const role = user?.role?.toUpperCase() ?? "EMPLOYEE";
  const firstName = user?.name?.split(" ")[0] ?? "User";

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const QUICK_LINKS = [
    { permission: PERMISSION_KEYS.APPROVAL_VIEW, href: "/approvals", label: "Pending Approvals", desc: "Items awaiting your decision" },
    { permission: PERMISSION_KEYS.REQUEST_VIEW, href: "/requests", label: "Requests", desc: "Track and raise purchase requests" },
    { permission: PERMISSION_KEYS.INVOICE_VIEW, href: "/invoices", label: "Invoices", desc: "Review and match invoices" },
    { permission: PERMISSION_KEYS.NOTIFICATION_VIEW, href: "/notifications", label: "Notifications", desc: "Your latest activity" },
    { permission: PERMISSION_KEYS.USER_MANAGE, href: "/settings/users", label: "User Directory", desc: "Manage people and roles" },
  ].filter((l) => hasPermission(user, l.permission));

  const maxSpend = data?.monthlySpendTrend?.length
    ? Math.max(...data.monthlySpendTrend.map((d) => d.spend), 1) : 1;

  const totalSpend = data?.monthlySpendTrend?.reduce((acc, m) => acc + m.spend, 0) ?? 0;
  const savings = (data?.totalSavingsThisMonth ?? data?.savingsThisMonth ?? 0);
  const pendingApprovals = data?.pendingRequestApprovals ?? 0;
  const invoicesWaiting = data?.invoicesWaitingApproval ?? 0;
  const contractsExpiring = (data?.contractExposure?.within30Days ?? 0) + (data?.contractExposure?.criticalExpirations ?? 0);
  const vendorRiskAlerts = (data?.vendorRiskExposure?.critical ?? 0) + (data?.vendorRiskExposure?.high ?? 0);

  // Sparklines render only from real series — never synthesize data points
  const spendSparkData = data?.monthlySpendTrend?.slice(-8).map((m) => m.spend);
  const savingsSparkData: number[] | undefined = undefined;
  const approvalsSparkData: number[] | undefined = undefined;
  const invoicesSparkData: number[] | undefined = undefined;

  // Category donut data
  const categoryColors = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6"];
  const categoryData: { label: string; pct: number; value: string }[] =
    data?.departmentSpend?.slice(0, 5).map((dept) => ({
      label: dept.department,
      pct: totalSpend > 0 ? Math.round((dept.spentBudget / totalSpend) * 100) : 0,
      value: formatMoney(dept.spentBudget),
    })) ?? [];

  // Donut SVG
  function DonutChart() {
    const R = 52; const CX = 70; const CY = 70;
    const circumference = 2 * Math.PI * R;
    let offset = 0;
    const segments = categoryData.map((d, i) => {
      const dash = (d.pct / 100) * circumference;
      const gap = circumference - dash;
      const el = (
        <circle key={i} cx={CX} cy={CY} r={R} fill="none"
          stroke={categoryColors[i % categoryColors.length]} strokeWidth="18"
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={-offset + circumference * 0.25}
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${CX}px ${CY}px` }}
        />
      );
      offset += dash;
      return el;
    });
    return (
      <svg viewBox="0 0 140 140" style={{ width: "140px", height: "140px" }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {segments}
        <text x={CX} y={CY - 4} textAnchor="middle" style={{ fontSize: "11px", fill: "#64748b", fontWeight: 500 }}>Total</text>
        <text x={CX} y={CY + 12} textAnchor="middle" style={{ fontSize: "13px", fill: "#0b1220", fontWeight: 700 }}>
          {totalSpend > 0 ? `₹${(totalSpend / 10000000).toFixed(2)} Cr` : "₹0"}
        </text>
      </svg>
    );
  }

  // Spend trend line chart
  function SpendTrendChart() {
    const trendData = data?.monthlySpendTrend?.slice(-6) ?? [];
    if (!trendData.length) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "140px", fontSize: "12px", color: "#94a3b8" }}>
          No spend recorded for this period yet.
        </div>
      );
    }
    const vals = trendData.map((d) => d.spend);
    const maxV = Math.max(...vals, 1);
    const W = 380; const H = 120;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * (W - 20) + 10;
      const y = H - (v / maxV) * (H - 10) - 5;
      return `${x.toFixed(0)},${y.toFixed(0)}`;
    });
    return (
      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", height: "140px" }}>
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`10,${H} ${pts.join(" ")} ${W - 10},${H}`} fill="url(#spendGrad)" />
        <polyline points={pts.join(" ")} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {trendData.map((d, i) => {
          const x = (i / (trendData.length - 1)) * (W - 20) + 10;
          return <text key={i} x={x} y={H + 16} textAnchor="middle" style={{ fontSize: "10px", fill: "#94a3b8", fontWeight: 500 }}>{d.month}</text>;
        })}
      </svg>
    );
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100%", padding: "0" }}>
      {/* ── INNER CONTENT ─────────────────────────── */}
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "28px 32px 40px" }}>

        {/* ── TOP: Greeting + Date Selector ─────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0b1220", letterSpacing: "-0.025em", margin: "0 0 4px" }}>
              {getGreeting()}, {firstName} 👋
            </h1>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
              Here&apos;s what&apos;s happening with {user?.department?.name ?? "your organization"} today.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <PeriodSelector label={`This Month (${now.toLocaleDateString("en-IN", { month: "long" })} ${now.getFullYear()})`} />
            <button style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", border: "1px solid #e8ecf0", borderRadius: "8px", background: "#fff", cursor: "pointer", color: "#64748b" }}>
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "15px", height: "15px" }}>
                <path fillRule="evenodd" d="M8 4a.75.75 0 0 1 .75.75V6.7l1.69-1.69a.75.75 0 0 1 1.06 1.06L9.06 8.5l2.44 2.44a.75.75 0 1 1-1.06 1.06L8.75 10.3v1.95a.75.75 0 0 1-1.5 0V8.75H5.3a.75.75 0 0 1 0-1.5h1.95V4.75A.75.75 0 0 1 8 4Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── NON-EXECUTIVE: Quick Links ─────────── */}
        {!canViewExecutive && (
          <div style={{ background: "#fff", border: "1px solid #e8ecf0", borderRadius: "14px", padding: "20px", marginBottom: "24px", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#0b1220", margin: "0 0 4px" }}>Welcome back, {user?.name ?? "User"}</p>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px" }}>Signed in as {role}. Jump back into your work:</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
              {QUICK_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="block no-underline p-[12px_14px] bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e8ecf0] hover:border-[#d1d8e0] rounded-[10px] transition-all duration-150">
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#0b1220", margin: "0 0 2px" }}>{link.label}</p>
                  <p style={{ fontSize: "11.5px", color: "#64748b", margin: 0 }}>{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {forbidden && (
          <div style={{ marginBottom: "24px" }}>
            <ErrorState
              title="Executive metrics blocked"
              description="Your session has executive access but the analytics service returned 403. Restart the API and run the seed, then refresh."
            />
          </div>
        )}

        {canViewExecutive && data ? (
          <div>
            {/* ── ROW 1: 6 KPI CARDS ─────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "14px", marginBottom: "20px" }}>
              <KpiCard
                label="Total Spend"
                value={formatMoney(totalSpend)}
                sparkData={spendSparkData}
                sparkColor="#6366f1"
                sparkFill="#6366f1"
                href="/analytics"
              />
              <KpiCard
                label="Savings Achieved"
                value={formatMoney(savings)}
                sparkData={savingsSparkData}
                sparkColor="#10b981"
                sparkFill="#10b981"
              />
              <KpiCard
                label="Pending Approvals"
                value={String(pendingApprovals)}
                sparkData={approvalsSparkData}
                sparkColor="#f59e0b"
                sparkFill="#f59e0b"
                href="/approvals"
              />
              <KpiCard
                label="Invoices Awaiting Approval"
                value={String(invoicesWaiting)}
                sparkData={invoicesSparkData}
                sparkColor="#f43f5e"
                sparkFill="#f43f5e"
                href="/invoices"
              />
              <KpiCard
                label="Contracts Expiring"
                value={String(contractsExpiring)}
                sparkColor="#8b5cf6"
                sparkFill="#8b5cf6"
                href="/contracts"
              />
              <KpiCard
                label="Vendor Risk Alerts"
                value={String(vendorRiskAlerts)}
                sparkColor="#0ea5e9"
                sparkFill="#0ea5e9"
                href="/vendors"
              />
            </div>

            {/* ── ROW 2: Charts ─────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: "14px", marginBottom: "20px" }}>

              {/* Spend Trend */}
              <DashCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 4px" }}>Spend Trend</p>
                    <p style={{ fontSize: "10.5px", color: "#94a3b8", margin: 0 }}>Total spend over time</p>
                  </div>
                  <PeriodSelector label="This Month" />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "6px 0 12px" }}>
                  <span style={{ fontSize: "22px", fontWeight: 700, color: "#0b1220", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
                    {formatMoney(totalSpend)}
                  </span>
                </div>
                <SpendTrendChart />
              </DashCard>

              {/* Spend by Category */}
              <DashCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#0b1220", margin: 0 }}>Spend by Category</p>
                  <PeriodSelector label="This Month" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ flexShrink: 0 }}>
                    <DonutChart />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {categoryData.slice(0, 5).map((cat, i) => (
                      <div key={cat.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: categoryColors[i % categoryColors.length], flexShrink: 0 }} />
                          <span style={{ fontSize: "11px", color: "#44546a", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.label}</span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#94a3b8", flexShrink: 0, marginLeft: "4px" }}>{cat.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </DashCard>

              {/* Top Vendors by Spend */}
              <DashCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#0b1220", margin: 0 }}>Top Vendors by Spend</p>
                  <PeriodSelector label="This Month" />
                </div>
                {!data.topVendors?.length && (
                  <p style={{ fontSize: "12px", color: "#94a3b8", margin: "8px 0" }}>No vendor spend recorded yet.</p>
                )}
                {(data.topVendors ?? []).slice(0, 5).map((row, i) => {
                  const topSpend = data.topVendors?.[0]?.spend || 1;
                  const pct = Math.round(((row.spend / topSpend) * 80) + 5);
                  return (
                    <div key={row.vendor} style={{ marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", width: "14px" }}>{i + 1}</span>
                          <span style={{ fontSize: "12px", fontWeight: 500, color: "#0b1220" }}>{row.vendor}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#0b1220", fontVariantNumeric: "tabular-nums" }}>{formatMoney(row.spend)}</span>
                          <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: "3px", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#6366f1", borderRadius: "9999px", opacity: 0.7 + (0.3 * ((5 - i) / 5)) }} />
                      </div>
                    </div>
                  );
                })}
              </DashCard>
            </div>

            {/* ── ROW 3: Pending Approvals + Budget + Activity ─── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr", gap: "14px", marginBottom: "20px" }}>

              {/* Pending Approvals */}
              <DashCard>
                <SectionHeader title="Pending Approvals" href="/approvals" />
                {(() => {
                  const rows = [
                    { label: "Purchase & request approvals", count: pendingApprovals, href: "/approvals", icon: "📄", priority: "High" },
                    { label: "Invoices awaiting approval", count: invoicesWaiting, href: "/invoices", icon: "🧾", priority: "Medium" },
                  ].filter((r) => r.count > 0);
                  if (!rows.length) {
                    return (
                      <p style={{ fontSize: "12px", color: "#94a3b8", margin: "8px 0" }}>Nothing awaiting your approval right now.</p>
                    );
                  }
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {rows.map((row) => (
                        <Link key={row.label} href={row.href} className="flex items-center justify-between p-[10px_12px] bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#eef2f6] rounded-[10px] no-underline transition-colors">
                          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "14px" }}>{row.icon}</span>
                            <span style={{ fontSize: "12.5px", fontWeight: 500, color: "#0b1220" }}>{row.label}</span>
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <PriorityBadge priority={row.priority} />
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#0b1220", fontVariantNumeric: "tabular-nums" }}>{row.count}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  );
                })()}
              </DashCard>

              {/* Budget Utilization */}
              <DashCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#0b1220", margin: 0 }}>Budget Utilization</p>
                  <PeriodSelector label="This Month" />
                </div>
                {!data.budgetUtilization.length && (
                  <p style={{ fontSize: "12px", color: "#94a3b8", margin: "8px 0" }}>No budgets configured yet.</p>
                )}
                {data.budgetUtilization.slice(0, 4).map((row) => {
                  const pct = row.utilization ?? Math.round((row.spentBudget / row.budget) * 100);
                  const barColor = pct > 85 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#6366f1";
                  return (
                    <div key={row.department} style={{ marginBottom: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#0b1220" }}>{row.department}</span>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
                            {formatMoney(row.spentBudget)} / {formatMoney(row.budget)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ flex: 1, height: "5px", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: barColor, borderRadius: "9999px", transition: "width 600ms ease" }} />
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: barColor, minWidth: "30px", textAlign: "right" }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </DashCard>

              {/* Activity Feed */}
              <DashCard>
                <SectionHeader title="Contracts Expiring" href="/contracts/renewals" />
                {!data.expiringContracts?.length && (
                  <p style={{ fontSize: "12px", color: "#94a3b8", margin: "8px 0" }}>No contracts expiring soon.</p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {(data.expiringContracts ?? []).slice(0, 5).map((item) => {
                    const color = item.severity === "CRITICAL" ? "#ef4444" : item.severity === "HIGH" ? "#f59e0b" : "#8b5cf6";
                    return (
                      <div key={item.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <div style={{
                          width: "28px", height: "28px", borderRadius: "50%",
                          background: `${color}15`, display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: "12px", flexShrink: 0,
                        }}>
                          📋
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "11.5px", fontWeight: 500, color: "#0b1220", margin: "0 0 1px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                          <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>{item.vendorName}</p>
                        </div>
                        <span style={{ fontSize: "10.5px", color, fontWeight: 600, flexShrink: 0 }}>{item.daysRemaining}d</span>
                      </div>
                    );
                  })}
                </div>
              </DashCard>
            </div>

            {/* ── AI INSIGHT BAR ─────────────────── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: "12px", padding: "14px 20px",
              boxShadow: "0 2px 8px rgba(99,102,241,0.15)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "16px", height: "16px", color: "#a5b4fc" }}>
                    <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
                  </svg>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.06em", textTransform: "uppercase" }}>AI Insight</span>
                  <p style={{ fontSize: "13px", color: "#e0e7ff", margin: "2px 0 0", fontWeight: 400 }}>
                    {savings > 0 ? (
                      <>
                        You&apos;ve captured{" "}
                        <strong style={{ color: "#ffffff" }}>{formatMoney(savings)}</strong> in savings this month
                        {vendorRiskAlerts > 0 ? (
                          <>
                            {" "}with{" "}
                            <strong style={{ color: "#ffffff" }}>{vendorRiskAlerts}</strong> vendor risk alert{vendorRiskAlerts === 1 ? "" : "s"} to review.
                          </>
                        ) : "."}
                      </>
                    ) : (
                      <>Review executive recommendations to uncover consolidation and savings opportunities.</>
                    )}
                  </p>
                </div>
              </div>
              <Link href="/executive/recommendations" className="flex items-center gap-[6px] p-[8px_14px] bg-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.18)] border border-[rgba(255,255,255,0.15)] rounded-lg text-xs font-semibold text-[#e0e7ff] no-underline shrink-0 transition-colors">
                View Recommendation
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: "12px", height: "12px" }}>
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>

          </div>
        ) : canViewExecutive && !forbidden ? (
          <EmptyState
            title="Executive metrics unavailable"
            description="Ensure the API is running on port 4000, then refresh."
          />
        ) : null}
      </div>
    </div>
  );
}
