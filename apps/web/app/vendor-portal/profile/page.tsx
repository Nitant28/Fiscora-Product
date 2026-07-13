"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = {
  name: string;
  gstin: string | null;
  pan: string | null;
  bankAccount: string | null;
  ifscCode: string | null;
  msmeNumber: string | null;
  contactPerson: string | null;
  kycStatus: string;
};

export default function VendorPortalProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    fetch("/api/proxy/vendor-portal/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!data.profile) {
          router.push("/vendor-portal/login");
          return;
        }
        setProfile(data.profile);
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setMessage(null);

    const res = await fetch(
      "/api/proxy/vendor-portal/profile",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gstin: profile.gstin,
          pan: profile.pan,
          bankAccount: profile.bankAccount,
          ifscCode: profile.ifscCode,
          msmeNumber: profile.msmeNumber,
          contactPerson: profile.contactPerson,
        }),
      }
    );

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessage(data.error ?? "Save failed");
      return;
    }

    setProfile(data.profile);
    setMessage("Profile updated — KYC pending review");
  }

  if (loading || !profile) {
    return (
      <div className="p-8 text-gray-500">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h2 className="text-3xl font-bold">Company Profile</h2>
      <p className="mt-2 text-gray-500">
        Update GST, PAN, bank, and MSME details for compliance
      </p>

      {message && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="mt-8 space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <Field
          label="Company"
          value={profile.name}
          disabled
        />
        <Field
          label="GSTIN"
          value={profile.gstin ?? ""}
          onChange={(v) =>
            setProfile({ ...profile, gstin: v })
          }
        />
        <Field
          label="PAN"
          value={profile.pan ?? ""}
          onChange={(v) =>
            setProfile({ ...profile, pan: v })
          }
        />
        <Field
          label="Bank Account"
          value={profile.bankAccount ?? ""}
          onChange={(v) =>
            setProfile({ ...profile, bankAccount: v })
          }
        />
        <Field
          label="IFSC Code"
          value={profile.ifscCode ?? ""}
          onChange={(v) =>
            setProfile({ ...profile, ifscCode: v })
          }
        />
        <Field
          label="MSME Number"
          value={profile.msmeNumber ?? ""}
          onChange={(v) =>
            setProfile({ ...profile, msmeNumber: v })
          }
        />
        <Field
          label="Contact Person"
          value={profile.contactPerson ?? ""}
          onChange={(v) =>
            setProfile({
              ...profile,
              contactPerson: v,
            })
          }
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-gray-50"
      />
    </label>
  );
}
