"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Account = { email: string; role: string; label: string };

export default function DevLoginClient({
  accounts,
}: {
  accounts: Account[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loginAs(email: string) {
    setBusy(email);
    setError(null);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Dev login failed");
        setBusy(null);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(null);
    }
  }

  async function signOut() {
    setBusy("__signout__");
    await fetch("/api/auth/dev-login", { method: "DELETE" });
    router.push("/dev-login");
    router.refresh();
    setBusy(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warning-fg">
            Development Mode
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Choose a demo user
          </h1>
          <p className="mt-1 text-sm text-muted">
            One-click sign-in for testing roles. No OTP. This page
            does not exist in production.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {accounts.map((a) => (
            <button
              key={a.email}
              onClick={() => loginAs(a.email)}
              disabled={busy !== null}
              className="flex w-full items-center justify-between border-b border-border px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-muted-soft disabled:opacity-60"
            >
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {a.label}
                </span>
                <span className="block text-xs text-muted">
                  {a.email}
                </span>
              </span>
              <span className="text-xs font-medium text-primary">
                {busy === a.email ? "Signing in…" : "Sign in →"}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-center text-xs text-danger-fg">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between text-xs">
          <button
            onClick={signOut}
            disabled={busy !== null}
            className="text-muted hover:text-foreground hover:underline"
          >
            Sign out dev session
          </button>
          <a
            href="/login"
            className="text-muted hover:text-foreground hover:underline"
          >
            Use real sign-in (Clerk) →
          </a>
        </div>
      </div>
    </main>
  );
}
