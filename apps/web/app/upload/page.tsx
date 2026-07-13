"use client";

/**
 * Upload Invoice
 * Purpose: Upload PDF invoices for OCR extraction and processing pipeline.
 * Data: POST /api/proxy/upload → POST /upload.
 * Roles: Users with invoice.upload.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    null
  );

  async function uploadFile() {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/proxy/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ?? "Upload failed"
        );
      }

      router.push("/invoices");
      router.refresh();
    } catch (uploadError) {
      console.error(uploadError);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Upload Invoice"
        description="Upload PDF invoices for AI processing and review."
      />

      {error && (
        <div className="mb-6 rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          {error}
        </div>
      )}

      <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-12 text-center shadow-card">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) =>
            setFile(e.target.files?.[0] ?? null)
          }
          className="mb-6"
        />

        <p className="mb-6 text-muted">
          {file ? file.name : "Choose a PDF or image file"}
        </p>

        <Button
          onClick={uploadFile}
          disabled={!file}
          loading={loading}
          variant="primary"
        >
          {loading ? "Uploading..." : "Upload Invoice"}
        </Button>
      </div>
    </PageContainer>
  );
}
