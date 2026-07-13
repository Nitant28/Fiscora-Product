"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Preview = {
  token: string;
  action: string;
  expired: boolean;
  used: boolean;
  request: {
    id: number;
    prNumber: string;
    title: string;
    amount: string;
    requester: string;
    department: string;
    status: string;
  };
};

export default function EmailApprovalClient({
  action,
  token,
}: {
  action: string;
  token: string;
}) {
  const [preview, setPreview] = useState<Preview | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const isApprove = action === "approve";
  const isReject = action === "reject";

  useEffect(() => {
    if (!isApprove && !isReject) {
      setLoading(false);
      return;
    }

    fetch(
      `/api/proxy/email-approvals/preview/${token}`
    )
      .then((res) => res.json())
      .then((data) => {
        setPreview(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, isApprove, isReject]);

  async function handleConfirm() {
    setSubmitting(true);
    setResult(null);

    const res = await fetch(
      `/api/proxy/email-approvals/${action}/${token}`,
      { method: "POST" }
    );

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setResult({
        ok: false,
        message: data.error ?? "Action failed",
      });
      return;
    }

    setResult({
      ok: true,
      message: isApprove
        ? `${data.prNumber ?? "Request"} approved. Audit logged as EMAIL_APPROVAL.`
        : `${data.prNumber ?? "Request"} rejected. Audit logged as EMAIL_APPROVAL.`,
    });
  }

  if (!isApprove && !isReject) {
    return (
      <main className="mx-auto max-w-lg p-8 text-center">
        <p className="text-red-600">Invalid approval link</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-lg p-8 text-center text-gray-500">
        Loading approval details…
      </main>
    );
  }

  if (!preview?.request) {
    return (
      <main className="mx-auto max-w-lg p-8 text-center">
        <p className="text-red-600">
          This approval link is invalid or expired.
        </p>
      </main>
    );
  }

  if (preview.used || preview.expired) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-2xl font-bold">Link unavailable</h1>
        <p className="mt-2 text-gray-600">
          {preview.used
            ? "This link has already been used."
            : "This link has expired."}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-blue-600 hover:underline"
        >
          Open Fiscora
        </Link>
      </main>
    );
  }

  if (preview.request.status !== "SUBMITTED") {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-2xl font-bold">Already processed</h1>
        <p className="mt-2 text-gray-600">
          {preview.request.prNumber} is{" "}
          {preview.request.status.toLowerCase()}.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-gray-500">
          Fiscora Email Approval
        </p>
        <h1 className="mt-2 text-2xl font-bold">
          {isApprove ? "Approve" : "Reject"}{" "}
          {preview.request.prNumber}
        </h1>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Title</dt>
            <dd className="font-medium text-right">
              {preview.request.title}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Amount</dt>
            <dd className="text-lg font-semibold">
              {preview.request.amount}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Requester</dt>
            <dd>{preview.request.requester}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Department</dt>
            <dd>{preview.request.department}</dd>
          </div>
        </dl>

        {result ? (
          <div
            className={`mt-8 rounded-lg border px-4 py-3 text-sm ${
              result.ok
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {result.message}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`mt-8 w-full rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-50 ${
              isApprove
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {submitting
              ? "Processing…"
              : isApprove
                ? "Confirm Approval"
                : "Confirm Rejection"}
          </button>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          Action recorded as EMAIL_APPROVAL in Audit Center
        </p>
      </div>
    </main>
  );
}
