"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DOC_TYPES = [
  "GST",
  "PAN",
  "MSME",
  "BANK_ACCOUNT",
  "COMPLIANCE",
] as const;

export default function VendorPortalDocumentsPage() {
  const router = useRouter();
  const [type, setType] = useState<string>("GST");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    null
  );

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    if (!file) {
      setMessage("Select a file to upload");
      return;
    }

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);

    const res = await fetch(
      "/api/proxy/vendor-portal/documents",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error ?? "Upload failed");
      return;
    }

    setMessage("Document uploaded — pending procurement review");
    setFile(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h2 className="text-3xl font-bold">KYC Documents</h2>
      <p className="mt-2 text-gray-500">
        Upload GST, PAN, bank proof, and compliance certificates
      </p>

      {message && (
        <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          {message}
        </div>
      )}

      <form
        onSubmit={handleUpload}
        className="mt-8 space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <label className="block text-sm font-medium">
          Document Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          >
            {DOC_TYPES.map((docType) => (
              <option key={docType} value={docType}>
                {docType.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          File
          <input
            type="file"
            onChange={(e) =>
              setFile(e.target.files?.[0] ?? null)
            }
            className="mt-1 block w-full text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Upload Document"}
        </button>
      </form>
    </div>
  );
}
