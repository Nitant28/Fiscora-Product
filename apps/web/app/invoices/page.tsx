"use client";

/**
 * Invoices List (V2)
 * Purpose: Searchable invoice registry with status filters and upload shortcut.
 * Data: GET /api/proxy/documents → GET /documents.
 * Roles: Users with invoice.view.
 *
 * Refined to use the Fiscora Design System components.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Input } from "@repo/ui/input";
import { Button } from "@repo/ui/button";
import { TabList, Tab } from "@repo/ui/tabs";
import { EmptyState } from "@repo/ui/empty-state";
import { SkeletonTable } from "@repo/ui/skeleton";
import { StatusBadge } from "@repo/ui/status-badge";
import {
  DataTable,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@repo/ui/data-table";
import { formatMoney, formatText } from "../../lib/metrics";
import { formatDateTime } from "../../lib/format";

type Invoice = {
  id: number;
  invoiceNumber: string | null;
  vendorName: string | null;
  totalAmount: number | null;
  status: string;
  createdAt: string;
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "processed", label: "Awaiting Review" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "blocked", label: "Blocked" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
] as const;

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<keyof Invoice>("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  async function loadInvoices() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();

      if (search) {
        params.append("search", search);
      }

      if (status) {
        params.append("status", status);
      }

      const query = params.toString();
      const url = query
        ? `/api/proxy/documents?${query}`
        : "/api/proxy/documents";

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        setInvoices([]);
        setError(
          data.error ??
            "Unable to load invoices. Sign in again if this persists."
        );
        return;
      }

      setInvoices(data.documents ?? []);
    } catch (loadError) {
      console.error(loadError);
      setInvoices([]);
      setError(
        "Could not reach the server. Check that the API is running."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadInvoices();
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, status]);

  const handleSort = (field: keyof Invoice) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedInvoices = [...invoices].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === null || valA === undefined) return sortOrder === "asc" ? -1 : 1;
    if (valB === null || valB === undefined) return sortOrder === "asc" ? 1 : -1;

    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    }

    return 0;
  });

  return (
    <PageContainer rhythm>
      {/* --- PAGE HEADER --- */}
      <PageHeader
        title="Invoices"
        description="Manage, review, and track all uploaded invoices."
        actions={
          <Link href="/upload">
            <Button variant="primary">
              Upload Invoice
            </Button>
          </Link>
        }
      />

      {/* --- SEARCH --- */}
      <div className="w-full">
        <Input
          type="text"
          placeholder="Search vendor or invoice number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
          }
          className="bg-surface shadow-xs"
        />
      </div>

      {/* --- STATUS FILTERS --- */}
      <TabList className="mb-2">
        {STATUS_FILTERS.map((filter) => (
          <Tab
            key={filter.value || "all"}
            id={filter.value || "all"}
            active={status === filter.value}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </Tab>
        ))}
      </TabList>

      {/* --- ERROR STATE --- */}
      {error && (
        <div className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg animate-fadeIn">
          {error}
        </div>
      )}

      {/* --- INVOICE TABLE / LIST STATE --- */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : sortedInvoices.length === 0 ? (
        <EmptyState
          title={status || search ? "No results found" : "No invoices uploaded"}
          description={
            status || search
              ? "Try adjusting your search query or filters."
              : "Upload an invoice to start processing spend governance."
          }
          action={
            !status && !search ? (
              <Link href="/upload">
                <Button variant="outline">
                  Upload your first invoice
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          emptyState={
            sortedInvoices.length === 0 ? (
              <div className="text-center text-muted text-xs">No entries</div>
            ) : undefined
          }
        >
          <THead>
            <TR>
              <TH
                sortDir={sortField === "id" ? sortOrder : null}
                onSort={() => handleSort("id")}
              >
                ID
              </TH>
              <TH
                sortDir={sortField === "invoiceNumber" ? sortOrder : null}
                onSort={() => handleSort("invoiceNumber")}
              >
                Invoice
              </TH>
              <TH
                sortDir={sortField === "vendorName" ? sortOrder : null}
                onSort={() => handleSort("vendorName")}
              >
                Vendor
              </TH>
              <TH
                numeric
                sortDir={sortField === "totalAmount" ? sortOrder : null}
                onSort={() => handleSort("totalAmount")}
              >
                Amount
              </TH>
              <TH
                sortDir={sortField === "status" ? sortOrder : null}
                onSort={() => handleSort("status")}
              >
                Status
              </TH>
              <TH
                sortDir={sortField === "createdAt" ? sortOrder : null}
                onSort={() => handleSort("createdAt")}
              >
                Date
              </TH>
            </TR>
          </THead>
          <TBody>
            {sortedInvoices.map((invoice, index) => (
              <TR key={invoice.id} hover zebra index={index}>
                <TD className="font-semibold text-foreground-subtle">
                  #{invoice.id}
                </TD>
                <TD>
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    {formatText(invoice.invoiceNumber)}
                  </Link>
                </TD>
                <TD className="font-medium">{formatText(invoice.vendorName)}</TD>
                <TD numeric className="font-semibold financial-figure">
                  {formatMoney(invoice.totalAmount)}
                </TD>
                <TD>
                  <StatusBadge status={invoice.status} />
                </TD>
                <TD className="text-xs text-muted">
                  {formatDateTime(invoice.createdAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      )}
    </PageContainer>
  );
}
