/**
 * Login Page — powered by Clerk (Sprint 18A activation).
 * The URL stays /login; the catch-all segment ([[...rest]]) lets Clerk handle
 * path-based sub-routes (factor-one, sso-callback).
 *
 * Identity = Clerk (who are you?). Authorization = Fiscora (tenant/role/permissions).
 * A verified Clerk identity that isn't provisioned in Fiscora is guided to request
 * workspace access — it is never silently downgraded.
 */
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 relative overflow-hidden font-sans">
      {/* Background ambient glows */}
      <div className="absolute top-[-20%] left-[-20%] -z-10 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] -z-10 h-[500px] w-[500px] rounded-full bg-emerald-600/5 blur-[120px]" />

      <div className="w-full max-w-[440px] z-10">
        {/* Logo and Brand */}
        <div className="mb-8 text-center flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2 group mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M2 4C2 2.895 2.895 2 4 2h8c1.105 0 2 .895 2 2v1H2V4z" fill="white" fillOpacity="0.95" />
                <rect x="2" y="7" width="12" height="2" rx="1" fill="white" fillOpacity="0.75" />
                <rect x="2" y="11" width="7" height="2" rx="1" fill="white" fillOpacity="0.55" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-indigo-400 transition-colors">
              Fiscora
            </span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sign in to your account
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Enterprise Procurement Platform
          </p>
        </div>

        {/* Clerk Sign In component */}
        <div className="flex justify-center rounded-2xl border border-slate-900 bg-slate-950/80 shadow-2xl backdrop-blur-sm overflow-hidden">
          <SignIn
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent border-0 shadow-none text-slate-100",
                headerTitle: "text-slate-100 hidden",
                headerSubtitle: "text-slate-400 hidden",
                socialButtonsBlockButton: "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white transition-all",
                formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 text-white transition-all",
                formFieldLabel: "text-slate-300",
                formFieldInput: "bg-slate-900/60 border-slate-800 text-white focus:border-indigo-500 focus:ring-indigo-500",
                footerActionText: "text-slate-400",
                footerActionLink: "text-indigo-400 hover:text-indigo-300",
                identityPreviewText: "text-slate-200",
                identityPreviewEditButton: "text-indigo-400 hover:text-indigo-300",
                formFieldInputShowPasswordButton: "text-slate-400 hover:text-slate-200",
              },
            }}
          />
        </div>

        {/* Provisioning Info Box */}
        <div className="mt-6 rounded-2xl border border-slate-900 bg-slate-950/40 px-5 py-4 text-center backdrop-blur-sm">
          <p className="text-xs font-semibold text-slate-200">
            Don&apos;t have access yet?
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            Sign in with your work account above. If your workspace hasn&apos;t been set up, you&apos;ll be guided to request access and an administrator will review it.
          </p>
        </div>

        {/* Legacy / Dev escape routes */}
        <div className="mt-6 flex items-center justify-between text-xs px-2">
          <a
            href="/legacy-login"
            className="text-slate-500 hover:text-slate-300 hover:underline transition-colors"
          >
            Use legacy sign-in
          </a>
          <Link
            href="/dev-login"
            className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline transition-colors"
          >
            Developer Login (Demo Accounts) →
          </Link>
        </div>
      </div>
    </main>
  );
}
