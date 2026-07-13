"use client";

/**
 * API Platform client (Sprint 27): create + revoke keys. The plaintext secret
 * is shown exactly once in a banner after creation — never retrievable again.
 */
import { useState } from "react";
import { formatDateTime } from "../../../lib/format";

type ApiKey = {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdByName: string | null;
  createdAt: string;
};

export default function DeveloperClient({
  initialKeys,
  scopes,
}: {
  initialKeys: ApiKey[];
  scopes: string[];
}) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    const res = await fetch("/api/proxy/api-keys", { cache: "no-store" });
    const data = await res.json();
    if (data.success) setKeys(data.keys ?? []);
  }

  function toggleScope(scope: string) {
    setSelected((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  }

  async function create() {
    if (!name.trim()) {
      setError("Please name your key");
      return;
    }
    setCreating(true);
    setError(null);
    setSecret(null);
    try {
      const res = await fetch("/api/proxy/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scopes: selected }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Could not create key");
      setSecret(data.key.secret);
      setName("");
      setSelected([]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create key");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: number) {
    if (!confirm("Revoke this key? Integrations using it will stop working."))
      return;
    const res = await fetch(`/api/proxy/api-keys/${id}`, {
      method: "DELETE",
    });
    if (res.ok) await refresh();
  }

  function copySecret() {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Developer / API Platform</h1>
        <p className="mt-1 text-gray-500">
          Issue scoped API keys for programmatic access. Keys are tenant-scoped
          and every action is audited.
        </p>
      </div>

      {secret && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-800">
            Key created — copy it now. You won&apos;t be able to see it again.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <code className="flex-1 overflow-x-auto rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-sm">
              {secret}
            </code>
            <button
              onClick={copySecret}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Create a new key</h2>
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Key name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ERP sync integration"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Scopes
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {scopes.map((scope) => (
                <button
                  key={scope}
                  onClick={() => toggleScope(scope)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selected.includes(scope)
                      ? "border-indigo-300 bg-indigo-100 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {scope}
                </button>
              ))}
              {scopes.length === 0 && (
                <span className="text-sm text-gray-400">
                  No scopes available.
                </span>
              )}
            </div>
          </div>
          <button
            onClick={create}
            disabled={creating}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create key"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Prefix</th>
              <th className="px-4 py-3">Scopes</th>
              <th className="px-4 py-3">Last used</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  No API keys yet. Create one above to get started.
                </td>
              </tr>
            )}
            {keys.map((key) => (
              <tr key={key.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {key.name}
                  {key.createdByName && (
                    <div className="text-xs text-gray-400">
                      by {key.createdByName}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {key.keyPrefix}…
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {key.scopes.length === 0 && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                    {key.scopes.map((s) => (
                      <span
                        key={s}
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "Never"}
                </td>
                <td className="px-4 py-3">
                  {key.revokedAt ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Revoked
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!key.revokedAt && (
                    <button
                      onClick={() => revoke(key.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
