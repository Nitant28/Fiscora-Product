"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";
import { EmptyState } from "@repo/ui/empty-state";
import { formatMoney } from "../../lib/metrics";

type CatalogItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  vendor: {
    name: string;
    preferredVendor: boolean;
  };
  department?: { name: string } | null;
};

export default function CatalogPage({
  items,
}: {
  items: CatalogItem[];
}) {
  const router = useRouter();
  const [loading, setLoading] =
    useState<number | null>(null);
  const [message, setMessage] = useState<
    string | null
  >(null);

  async function order(itemId: number) {
    setLoading(itemId);
    setMessage(null);

    try {
      const res = await fetch("/api/proxy/catalog/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          catalogItemId: itemId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ?? "Order failed"
        );
      }

      setMessage(
        `PO ${data.po?.poNumber ?? ""} auto-generated — no approval needed`
      );
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Order failed"
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Approved Catalog"
        description="Pre-approved items — budget check and PO auto-generated"
      />

      {message && (
        <div className="mb-6 rounded-lg border border-success-border bg-success-soft px-4 py-3 text-sm text-success-fg">
          {message}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No catalog items"
          description="Approved catalog items will appear here once configured."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border bg-surface p-6 shadow-card"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {item.name}
                </h2>
                {item.vendor.preferredVendor && (
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-fg">
                    Preferred
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-foreground-subtle">
                {item.description ?? "—"}
              </p>
              <p className="mt-2 text-sm text-muted">
                Vendor: {item.vendor.name}
              </p>
              {item.department && (
                <p className="text-sm text-muted">
                  Dept: {item.department.name}
                </p>
              )}
              <p className="mt-4 text-2xl font-bold text-foreground">
                {formatMoney(item.price)}
              </p>
              <Button
                onClick={() => order(item.id)}
                loading={loading === item.id}
                fullWidth
                className="mt-4"
                variant="primary"
              >
                {loading === item.id
                  ? "Processing..."
                  : "Order — No Approval Needed"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
