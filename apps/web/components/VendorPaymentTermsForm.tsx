"use client";

/**
 * VendorPaymentTermsForm
 * Purpose: Edit vendor default payment terms (net days, early pay discount).
 * Data: PATCH /api/proxy/vendors/:id.
 * Roles: vendor.manage.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PAYMENT_TERM_OPTIONS,
  formatPaymentTermsLabel,
} from "../lib/paymentTerms";

export default function VendorPaymentTermsForm({
  vendorId,
  currentTermsDays,
  msmeRegistered,
}: {
  vendorId: number;
  currentTermsDays: number | null;
  msmeRegistered: boolean;
}) {
  const router = useRouter();
  const [termsDays, setTermsDays] =
    useState(
      currentTermsDays?.toString() ?? "30"
    );
  const [msme, setMsme] = useState(
    msmeRegistered
  );
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState<
    string | null
  >(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(
        `/api/proxy/vendors/${vendorId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            paymentTermsDays: Number(
              termsDays
            ),
            msmeRegistered: msme,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Failed to update terms"
        );
      }

      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update terms"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border bg-white p-6 shadow-sm"
    >
      <h2 className="mb-1 text-lg font-semibold">
        Payment Terms
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Due dates on all payments are
        calculated from these terms.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Payment terms saved.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Terms
          </label>
          <select
            value={termsDays}
            onChange={(e) =>
              setTermsDays(e.target.value)
            }
            className="w-full rounded-lg border px-4 py-2"
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
          <p className="mt-1 text-xs text-gray-500">
            Current:{" "}
            {currentTermsDays != null
              ? formatPaymentTermsLabel(
                  currentTermsDays
                )
              : "Not set"}
          </p>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={msme}
              onChange={(e) =>
                setMsme(e.target.checked)
              }
              className="rounded border-gray-300"
            />
            MSME registered (45-day payment
            cap applies)
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading
          ? "Saving..."
          : "Save Payment Terms"}
      </button>
    </form>
  );
}
