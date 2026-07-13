"use client";

/**
 * RFQBidForm
 * Purpose: Submit or update a vendor bid on an open RFQ.
 * Data: POST /api/proxy/rfqs/:id/bids.
 * Roles: rfq.manage (procurement entering bids).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

type Vendor = {
  id: number;
  name: string;
};

export default function RFQBidForm({
  rfqId,
  vendors,
  disabled,
}: {
  rfqId: number;
  vendors: Vendor[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState<
    string | null
  >(null);

  const [vendorId, setVendorId] =
    useState("");
  const [quotedAmount, setQuotedAmount] =
    useState("");
  const [leadTimeDays, setLeadTimeDays] =
    useState("");
  const [
    warrantyMonths,
    setWarrantyMonths,
  ] = useState("");

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/proxy/rfqs/${rfqId}/bids`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            vendorId: Number(vendorId),
            quotedAmount: Number(
              quotedAmount
            ),
            leadTimeDays: Number(
              leadTimeDays
            ),
            warrantyMonths: Number(
              warrantyMonths
            ),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Failed to submit bid"
        );
      }

      setVendorId("");
      setQuotedAmount("");
      setLeadTimeDays("");
      setWarrantyMonths("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit bid"
      );
    } finally {
      setLoading(false);
    }
  }

  if (disabled) {
    return null;
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">
        Submit Vendor Bid
      </h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Vendor
          </label>
          <select
            required
            value={vendorId}
            onChange={(e) =>
              setVendorId(e.target.value)
            }
            className="w-full rounded-lg border px-4 py-2"
          >
            <option value="">
              Select vendor
            </option>
            {vendors.map((v) => (
              <option
                key={v.id}
                value={v.id}
              >
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Quoted Amount (₹)
          </label>
          <input
            type="number"
            required
            min="1"
            value={quotedAmount}
            onChange={(e) =>
              setQuotedAmount(
                e.target.value
              )
            }
            className="w-full rounded-lg border px-4 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Lead Time (days)
          </label>
          <input
            type="number"
            required
            min="1"
            value={leadTimeDays}
            onChange={(e) =>
              setLeadTimeDays(
                e.target.value
              )
            }
            className="w-full rounded-lg border px-4 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Warranty (months)
          </label>
          <input
            type="number"
            required
            min="0"
            value={warrantyMonths}
            onChange={(e) =>
              setWarrantyMonths(
                e.target.value
              )
            }
            className="w-full rounded-lg border px-4 py-2"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {loading
              ? "Submitting..."
              : "Submit Bid"}
          </button>
        </div>
      </form>
    </section>
  );
}
