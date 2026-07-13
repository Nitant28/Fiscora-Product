"use client";

import { useState } from "react";

export default function RequestAccessForm() {
  const [open, setOpen] = useState(false);
  const [department, setDepartment] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "submitted" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage(null);

    try {
      const res = await fetch("/api/proxy/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department, reason }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not submit request");
        return;
      }

      setStatus("submitted");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "submitted") {
    return (
      <div className="mt-8 rounded-lg border border-success-soft bg-success-soft px-4 py-4 text-center">
        <p className="text-sm font-semibold text-success-fg">
          Request submitted
        </p>
        <p className="mt-1 text-xs text-success-fg">
          An administrator has been notified. You&apos;ll get
          access once they approve your request.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-8 flex items-center justify-center">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
        >
          Request workspace access
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4 text-left">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Department (optional)
        </label>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="e.g. Finance, IT, Procurement"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Reason for access (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Briefly describe why you need access"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>

      {status === "error" && message && (
        <p className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-xs text-danger-fg">
          {message}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted-soft"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
        >
          {status === "submitting" ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}
