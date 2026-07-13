"use client";

/**
 * Vendor Onboarding Admin
 * Purpose: Invite vendors, review pending applications, activate approved vendors.
 * Data: /api/proxy/vendor-onboarding/* → vendor-onboarding API.
 * Roles: vendor.invite, vendor.manage (Procurement, Admin).
 */
import { useEffect, useState } from "react";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";
import {
  PAYMENT_TERM_OPTIONS,
} from "../../../lib/paymentTerms";

type PendingVendor = {
  id: number;
  name: string;
  email: string | null;
  status: string;
  paymentTermsDays: number | null;
  onboardingDocs: {
    type: string;
    status: string;
  }[];
};

export default function VendorOnboardingAdmin() {
  const [vendors, setVendors] = useState<
    PendingVendor[]
  >([]);
  const [email, setEmail] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [inviteUrl, setInviteUrl] = useState<
    string | null
  >(null);
  const [activateTerms, setActivateTerms] =
    useState<Record<number, string>>({});
  const [activateMsme, setActivateMsme] =
    useState<Record<number, boolean>>({});

  async function load() {
    const res = await fetch(
      "/api/proxy/vendor-onboarding/pending"
    );
    if (res.ok) {
      const data = await res.json();
      setVendors(data.vendors ?? []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(
      "/api/proxy/vendor-onboarding/invite",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          vendorName,
        }),
      }
    );
    const data = await res.json();
    if (res.ok) {
      const path =
        data.inviteUrl ??
        `/vendor-onboarding/${data.inviteToken ?? ""}`;
      setInviteUrl(path);
      setEmail("");
      setVendorName("");
      load();
    } else {
      alert(data.error ?? "Invite failed");
    }
  }

  async function activate(vendorId: number) {
    const terms =
      activateTerms[vendorId] ?? "30";

    const res = await fetch(
      `/api/proxy/vendor-onboarding/review/${vendorId}/activate`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          paymentTermsDays: Number(terms),
          msmeRegistered:
            activateMsme[vendorId] ?? false,
        }),
      }
    );
    const data = await res.json();
    if (res.ok) {
      load();
    } else {
      alert(data.error ?? "Activation failed");
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Vendor Onboarding"
        description="Invite vendors and review compliance"
      />

      <form
        onSubmit={invite}
        className="mb-10 rounded-2xl border border-border bg-surface p-6 shadow-card"
      >
        <h2 className="mb-4 font-semibold text-foreground">
          Send Invite
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            required
            placeholder="Vendor email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
          />
          <input
            required
            placeholder="Vendor name"
            value={vendorName}
            onChange={(e) =>
              setVendorName(e.target.value)
            }
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
          />
        </div>
        <Button type="submit" className="mt-4" size="sm">
          Send Invite
        </Button>
        {inviteUrl && (
          <div className="mt-4 rounded-lg border border-success-border bg-success-soft p-4">
            <p className="mb-2 text-sm font-medium text-success-fg">
              Invite link ready — send this to the vendor:
            </p>
            <InviteLink path={inviteUrl} />
          </div>
        )}
      </form>

      <div className="space-y-4">
        {vendors.map((v) => (
          <div
            key={v.id}
            className="rounded-xl border border-border bg-surface p-5 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-foreground">
                  {v.name}
                </p>
                <p className="text-sm text-muted">
                  {v.email} · {v.status}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Docs:{" "}
                  {v.onboardingDocs.length} uploaded
                </p>
              </div>
              {v.status === "PENDING_REVIEW" && (
                <div className="flex flex-col items-end gap-2">
                  <select
                    value={
                      activateTerms[v.id] ??
                      "30"
                    }
                    onChange={(e) =>
                      setActivateTerms(
                        (prev) => ({
                          ...prev,
                          [v.id]:
                            e.target.value,
                        })
                      )
                    }
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
                  >
                    {PAYMENT_TERM_OPTIONS.map(
                      (option) => (
                        <option
                          key={option.days}
                          value={option.days}
                        >
                          {option.label}
                        </option>
                      )
                    )}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-foreground-subtle">
                    <input
                      type="checkbox"
                      checked={
                        activateMsme[v.id] ??
                        false
                      }
                      onChange={(e) =>
                        setActivateMsme(
                          (prev) => ({
                            ...prev,
                            [v.id]:
                              e.target
                                .checked,
                          })
                        )
                      }
                    />
                    MSME registered
                  </label>
                  <Button
                    onClick={() => activate(v.id)}
                    size="sm"
                    className="bg-success text-white hover:bg-success/90"
                  >
                    Activate Vendor
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

function InviteLink({ path }: { path: string }) {
  const [fullUrl, setFullUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setFullUrl(`${window.location.origin}${path}`);
  }, [path]);

  async function copyLink() {
    if (!fullUrl) {
      return;
    }

    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!fullUrl) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sm text-primary underline hover:text-primary-hover"
      >
        {fullUrl}
      </a>
      <button
        type="button"
        onClick={copyLink}
        className="shrink-0 rounded-lg border border-success-border bg-surface px-3 py-1.5 text-sm text-success-fg hover:bg-success-soft"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
