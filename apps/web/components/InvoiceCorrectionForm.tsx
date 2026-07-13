"use client";

/**
 * InvoiceCorrectionForm
 * Purpose: Submit human corrections to extracted invoice fields.
 * Data: POST /api/proxy/documents/:id/correct.
 * Roles: invoice.approve, invoice.view.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

type CorrectionField =
  | "vendorName"
  | "totalAmount"
  | "invoiceDate"
  | "subtotal"
  | "shipping"
  | "discount";

export default function InvoiceCorrectionForm({
  invoiceId,
  vendorName,
  totalAmount,
  invoiceDate,
  subtotal,
  shipping,
  discount,
  fullEditor = false,
}: {
  invoiceId: number;
  vendorName?: string | null;
  totalAmount?: number | null;
  invoiceDate?: string | null;
  subtotal?: number | null;
  shipping?: number | null;
  discount?: number | null;
  fullEditor?: boolean;
}) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [values, setValues] =
    useState({
      vendorName:
        vendorName ?? "",
      totalAmount:
        totalAmount?.toString() ?? "",
      invoiceDate:
        invoiceDate ?? "",
      subtotal:
        subtotal?.toString() ?? "",
      shipping:
        shipping?.toString() ?? "",
      discount:
        discount?.toString() ?? "",
    });

  async function saveCorrection(
    field: CorrectionField
  ) {
    const correctedValue =
      values[field];

    if (!correctedValue.trim()) {
      return;
    }

    const originalMap: Record<
      CorrectionField,
      string
    > = {
      vendorName:
        vendorName ?? "",
      totalAmount:
        totalAmount?.toString() ?? "",
      invoiceDate:
        invoiceDate ?? "",
      subtotal:
        subtotal?.toString() ?? "",
      shipping:
        shipping?.toString() ?? "",
      discount:
        discount?.toString() ?? "",
    };

    try {
      setLoading(true);

      const res = await fetch(
        `/api/proxy/documents/${invoiceId}/correct`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            field,
            originalValue:
              originalMap[field],
            correctedValue,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          "Correction failed"
        );
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      alert(
        "Failed to save correction"
      );
    } finally {
      setLoading(false);
    }
  }

  const fields: Array<{
    key: CorrectionField;
    label: string;
  }> = [
    {
      key: "vendorName",
      label: "Vendor",
    },
    {
      key: "totalAmount",
      label: "Total Amount",
    },
    {
      key: "invoiceDate",
      label: "Invoice Date",
    },
    {
      key: "subtotal",
      label: "Subtotal",
    },
    {
      key: "shipping",
      label: "Shipping",
    },
    {
      key: "discount",
      label: "Discount",
    },
  ];

  if (!fullEditor) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="mb-4 text-lg font-semibold text-amber-900">
        Correct Extraction
      </h3>

      <div className="space-y-3">
        {fields.map(({ key, label }) => (
          <div
            key={key}
            className="flex gap-2"
          >
            <div className="flex-1">
              <label className="text-xs text-gray-500">
                {label}
              </label>
              <input
                type="text"
                value={values[key]}
                onChange={(e) =>
                  setValues({
                    ...values,
                    [key]:
                      e.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <button
              disabled={loading}
              onClick={() =>
                saveCorrection(key)
              }
              className="mt-5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
