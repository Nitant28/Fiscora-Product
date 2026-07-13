"use client";

/**
 * Vendor Onboarding Portal (Public)
 * Purpose: Token-based vendor self-registration and document upload (no login).
 * Data: /api/proxy/vendor-onboarding/public/:token/*.
 * Roles: Public invitee (unauthenticated).
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@repo/ui/button";

const DOC_TYPES = [
  "GST",
  "PAN",
  "BANK_ACCOUNT",
  "INSURANCE",
  "COMPLIANCE",
  "MSA",
  "NDA",
] as const;

export default function VendorOnboardingPortal() {
  const params = useParams();
  const token = params.token as string;

  const [invite, setInvite] = useState<{
    vendor?: { id: number; name: string; email: string | null };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState({
    gstNumber: "",
    panNumber: "",
    bankAccount: "",
    contactPerson: "",
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(
      `/api/proxy/vendor-onboarding/public/${token}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) {
          throw new Error(d.error);
        }
        setInvite(d.invite);
      })
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Invalid invite"
        )
      );
  }, [token]);

  async function uploadDoc(
    docType: string,
    file: File
  ) {
    setUploading(docType);
    const form = new FormData();
    form.append("file", file);
    form.append("docType", docType);

    try {
      const res = await fetch(
        `/api/proxy/vendor-onboarding/public/${token}/upload`,
        { method: "POST", body: form }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }
      setUploaded((prev) =>
        new Set(prev).add(docType)
      );
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Upload failed"
      );
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    try {
      const res = await fetch(
        `/api/proxy/vendor-onboarding/public/${token}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profile),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Submit failed");
      }
      setSubmitted(true);
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Submit failed"
      );
    }
  }

  if (error) {
    return (
      <main className="p-8 text-danger-fg">
        {error}
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="p-8 text-muted">
        Loading...
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <div className="rounded-2xl border border-success-border bg-success-soft p-8 text-center">
          <h1 className="text-2xl font-bold text-success-fg">
            Onboarding Submitted
          </h1>
          <p className="mt-2 text-success-fg">
            Your documents are under review.
            Procurement will activate your vendor
            account once validated.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-foreground">
        Vendor Onboarding
      </h1>
      <p className="mb-8 text-muted">
        {invite.vendor?.name} — upload compliance
        documents
      </p>

      <div className="mb-8 space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 className="font-semibold text-foreground">
          Company Details
        </h2>
        {(
          [
            ["gstNumber", "GST Number"],
            ["panNumber", "PAN"],
            ["bankAccount", "Bank Account"],
            ["contactPerson", "Contact Person"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label className="mb-1 block text-sm text-foreground-subtle">
              {label}
            </label>
            <input
              value={profile[key]}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  [key]: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
            />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {DOC_TYPES.map((docType) => (
          <div
            key={docType}
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-card"
          >
            <div>
              <p className="font-medium text-foreground">
                {docType.replace(/_/g, " ")}
              </p>
              {uploaded.has(docType) && (
                <p className="text-xs text-success-fg">
                  Uploaded
                </p>
              )}
            </div>
            <label className="focus-ring cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm text-primary-fg transition-colors hover:bg-primary-hover">
              {uploading === docType
                ? "Uploading..."
                : "Upload"}
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file =
                    e.target.files?.[0];
                  if (file) {
                    uploadDoc(docType, file);
                  }
                }}
              />
            </label>
          </div>
        ))}
      </div>

      <Button
        onClick={submit}
        fullWidth
        size="lg"
        className="mt-8 bg-success text-white hover:bg-success/90"
      >
        Submit for Review
      </Button>
    </main>
  );
}
