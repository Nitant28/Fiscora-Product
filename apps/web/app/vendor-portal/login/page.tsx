"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VendorPortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("vendor@fiscora.com");
  const [password, setPassword] = useState("fiscora123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        "/api/proxy/vendor-portal/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Login failed");
      }

      router.push("/vendor-portal/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-2xl border bg-white p-8 shadow-sm"
      >
        <h2 className="text-2xl font-bold">Vendor Login</h2>
        <p className="mt-2 text-sm text-gray-500">
          Access RFQs, purchase orders, invoices, and payments
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <label className="mt-6 block text-sm font-medium">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p className="mt-4 text-xs text-gray-500">
          Demo: vendor@fiscora.com / fiscora123
        </p>
      </form>
    </div>
  );
}
