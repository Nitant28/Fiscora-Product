"use client";

import { useState } from "react";
import { Button } from "@repo/ui/button";

type ImportResult = {
  imported: number;
  warnings: number;
  failed: number;
  errors?: { row: number; message: string }[];
  warningsList?: { row: number; message: string }[];
};

type ImportCsvFormProps = {
  title: string;
  description: string;
  endpoint: string;
  formatHint: string;
  sampleCsv: string;
};

export default function ImportCsvForm({
  title,
  description,
  endpoint,
  formatHint,
  sampleCsv,
}: ImportCsvFormProps) {
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
    setResult(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!csv.trim()) {
      setError("Upload a CSV file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, fileName: fileName || "upload.csv" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-muted">{description}</p>
      </div>

      <div className="rounded-xl border border-border bg-surface-subtle p-4">
        <p className="text-sm font-medium text-foreground-subtle">CSV format</p>
        <p className="mt-1 font-mono text-sm text-muted">{formatHint}</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-surface p-3 text-xs text-foreground-subtle">
          {sampleCsv}
        </pre>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-foreground"
        />

        <Button type="submit" loading={loading} size="lg" variant="primary">
          {loading ? "Importing…" : "Import CSV"}
        </Button>
      </form>

      {error && (
        <div className="rounded-xl border border-danger-border bg-danger-soft p-4 text-danger-fg">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <h3 className="text-lg font-semibold text-foreground">Import results</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-success-soft p-4">
              <p className="text-sm text-success-fg">Imported</p>
              <p className="text-3xl font-bold text-success-fg">{result.imported}</p>
            </div>
            <div className="rounded-lg bg-warning-soft p-4">
              <p className="text-sm text-warning-fg">Warnings</p>
              <p className="text-3xl font-bold text-warning-fg">{result.warnings}</p>
            </div>
            <div className="rounded-lg bg-danger-soft p-4">
              <p className="text-sm text-danger-fg">Failed</p>
              <p className="text-3xl font-bold text-danger-fg">{result.failed}</p>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="mt-4">
              <p className="font-medium text-danger-fg">Failed rows</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-danger-fg">
                {result.errors.map((item) => (
                  <li key={`e-${item.row}-${item.message}`}>
                    Row {item.row}: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.warningsList && result.warningsList.length > 0 && (
            <div className="mt-4">
              <p className="font-medium text-warning-fg">Warnings</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-warning-fg">
                {result.warningsList.map((item) => (
                  <li key={`w-${item.row}-${item.message}`}>
                    Row {item.row}: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
