import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../lib/api";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-0 left-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
      <div className="absolute top-[20%] right-1/4 -z-10 h-[600px] w-[600px] rounded-full bg-emerald-600/5 blur-[150px]" />

      {/* Header / Nav */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/70 border-b border-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M2 4C2 2.895 2.895 2 4 2h8c1.105 0 2 .895 2 2v1H2V4z" fill="white" fillOpacity="0.95" />
                <rect x="2" y="7" width="12" height="2" rx="1" fill="white" fillOpacity="0.75" />
                <rect x="2" y="11" width="7" height="2" rx="1" fill="white" fillOpacity="0.55" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white bg-clip-text group-hover:text-indigo-400 transition-colors">
              Fiscora
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <a
              href="mailto:hello@fiscora.ai?subject=Book%20a%20Fiscora%20Demo"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25"
            >
              Book Demo
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-6 pt-20 pb-32">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-4 py-1.5 text-xs font-medium text-indigo-400 mb-6 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            Procurement Intelligence for High-Growth Enterprises
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white leading-[1.1] md:text-7xl bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Control spend. Automate approvals. Prove savings.
          </h1>
          <p className="mt-8 text-lg md:text-xl text-slate-400 leading-relaxed max-w-3xl">
            Fiscora empowers CFOs and procurement leaders to govern vendor spend, risk compliance, contracts, and board-ready ROI — from purchase request to Tally export.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/login"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-8 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 duration-150"
            >
              Start Free Pilot
            </Link>
            <a
              href="mailto:hello@fiscora.ai?subject=Book%20a%20Fiscora%20Demo"
              className="rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700 px-8 py-4 text-base font-semibold text-slate-300 hover:text-white transition-all duration-150"
            >
              Schedule Demo
            </a>
          </div>
        </div>

        {/* Stunning Interactive Mock Dashboard Preview */}
        <div className="relative mx-auto max-w-5xl rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 shadow-2xl shadow-indigo-500/5 backdrop-blur-sm mb-28">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-90 rounded-2xl" />
          <div className="rounded-xl border border-slate-900 bg-slate-900/20 overflow-hidden aspect-[16/10] flex flex-col pointer-events-none">
            {/* Mock Header */}
            <div className="h-12 border-b border-slate-900 bg-slate-950/90 px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                </div>
                <div className="w-1 px-1" />
                <div className="h-6 w-32 rounded bg-slate-900" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-900" />
              </div>
            </div>
            {/* Mock Body */}
            <div className="flex flex-1 min-h-0 bg-slate-950/40">
              {/* Mock Sidebar */}
              <div className="w-48 border-r border-slate-900 bg-slate-950/80 p-3 flex flex-col gap-2 shrink-0">
                <div className="h-7 rounded bg-indigo-500/10 border border-indigo-500/20" />
                <div className="h-6 rounded bg-slate-900/50" />
                <div className="h-6 rounded bg-slate-900/50" />
                <div className="h-6 rounded bg-slate-900/50" />
                <div className="h-6 rounded bg-slate-900/50" />
              </div>
              {/* Mock Dashboard Page */}
              <div className="flex-1 p-5 flex flex-col gap-4 overflow-hidden">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="h-5 w-44 rounded bg-slate-800" />
                    <div className="h-3 w-56 rounded bg-slate-900" />
                  </div>
                  <div className="h-8 w-24 rounded bg-slate-900" />
                </div>
                {/* 4 Cards */}
                <div className="grid grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-slate-900 bg-slate-950 p-3 space-y-2">
                      <div className="h-3 w-16 rounded bg-slate-900" />
                      <div className="h-6 w-24 rounded bg-slate-800" />
                      <div className="h-2.5 w-12 rounded bg-slate-900" />
                    </div>
                  ))}
                </div>
                {/* Two Column Section */}
                <div className="grid grid-cols-3 gap-3 flex-1">
                  <div className="col-span-2 rounded-xl border border-slate-900 bg-slate-950 p-3 space-y-2">
                    <div className="h-4 w-28 rounded bg-slate-900" />
                    <div className="flex-1 flex items-end justify-between h-20 pt-2 px-2">
                      <div className="w-8 bg-indigo-500/20 rounded-t h-8" />
                      <div className="w-8 bg-indigo-500/40 rounded-t h-12" />
                      <div className="w-8 bg-indigo-500/50 rounded-t h-16" />
                      <div className="w-8 bg-indigo-500/70 rounded-t h-20" />
                      <div className="w-8 bg-indigo-500 rounded-t h-24" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-900 bg-slate-950 p-3 space-y-2">
                    <div className="h-4 w-28 rounded bg-slate-900" />
                    <div className="space-y-2.5 pt-2">
                      <div className="flex justify-between items-center">
                        <div className="h-3 w-16 rounded bg-slate-900" />
                        <div className="h-3 w-8 rounded bg-slate-800" />
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="h-3 w-20 rounded bg-slate-900" />
                        <div className="h-3 w-8 rounded bg-slate-800" />
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="h-3 w-12 rounded bg-slate-900" />
                        <div className="h-3 w-8 rounded bg-slate-800" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <section className="mb-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Engineered for Enterprise Governance
            </h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
              Everything required to manage high-volume procurement budgets, automate workflow chains, and keep auditors happy.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Procurement & approvals",
                desc: "Granular approval chains matching your corporate authorization matrix. Multi-level triggers by amount or department.",
                icon: "⚡",
              },
              {
                title: "Vendor compliance & risk",
                desc: "Real-time compliance monitoring, risk mapping, GST validation, and alerts for critical supplier exposure.",
                icon: "🛡️",
              },
              {
                title: "Contract intelligence",
                desc: "AI contract scanning to track expirations, pricing renewals, commitments, and commercial liabilities.",
                icon: "📄",
              },
              {
                title: "Savings & ROI reporting",
                desc: "Automatically quantify negotiated savings vs. benchmark pricing. Export quarterly summaries ready for boardroom review.",
                icon: "📈",
              },
              {
                title: "Tally-ready exports",
                desc: "One-click voucher exports formatted for your Tally, SAP, or custom ERP backend to eliminate manual entries.",
                icon: "⚙️",
              },
              {
                title: "Enterprise control tower",
                desc: "Consolidated views for multi-entity companies, audit trail logging, and granular user roles (RBAC).",
                icon: "🏰",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative rounded-2xl border border-slate-900 bg-slate-900/20 hover:bg-slate-900/40 p-6 transition-all duration-200 hover:border-slate-800"
              >
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                  {f.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Social Proof */}
        <section className="rounded-3xl border border-indigo-500/10 bg-gradient-to-tr from-slate-950 to-indigo-950/20 p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Built for mid-market manufacturing & finance teams
            </h2>
            <p className="mt-3 text-slate-400 leading-relaxed">
              500+ employees. Hundreds of active vendor relationships. Thousands of invoices. Governed securely in a centralized platform with complete audit traceability and compliance checks.
            </p>
          </div>
          <Link
            href="/login"
            className="rounded-xl bg-white hover:bg-slate-100 px-6 py-3.5 text-sm font-semibold text-slate-950 transition-all shrink-0 shadow-lg shadow-white/5"
          >
            Get Started Now
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center font-bold text-[10px] text-white">
              F
            </div>
            <span>© {new Date().getFullYear()} Fiscora. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy-policy" className="hover:text-slate-300">Privacy Policy</Link>
            <a href="mailto:hello@fiscora.ai" className="hover:text-slate-300">Contact Us</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
