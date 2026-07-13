"use client";

/**
 * Dev session account control (DEV ONLY) — replaces Clerk's UserButton when the
 * user signed in via /dev-login (a legacy cookie session Clerk can't manage).
 * Lets you sign out or jump straight to /dev-login to switch demo roles.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function DevAccountMenu({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function signOut(thenSwitch: boolean) {
    setBusy(true);
    await fetch("/api/auth/dev-login", { method: "DELETE" }).catch(
      () => {}
    );
    router.push(thenSwitch ? "/dev-login" : "/login");
    router.refresh();
  }

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 py-1 pl-1 pr-3 text-sm transition-colors hover:bg-amber-100"
        title="Development session"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-semibold text-white">
          {initials || "?"}
        </span>
        <span className="hidden text-xs font-medium text-amber-900 sm:inline">
          {name}
        </span>
        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          dev
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">
              {name}
            </p>
            <p className="text-xs text-gray-500">
              {role} · development session
            </p>
          </div>
          <button
            onClick={() => signOut(true)}
            disabled={busy}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Switch demo account
          </button>
          <button
            onClick={() => signOut(false)}
            disabled={busy}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
