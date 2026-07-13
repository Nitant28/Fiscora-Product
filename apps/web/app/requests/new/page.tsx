"use client";

/**
 * New Purchase Request
 * Purpose: Create a spend request with department budget and category selection.
 * Data: GET /departments, GET /spend-categories; POST /purchase-requests (direct API).
 * Roles: request.create (Employee, Manager, etc.).
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";
import { formatMoney } from "../../../lib/metrics";

type Department = {
  id: number;
  name: string;
  budget: number;
  reservedBudget: number;
  committedBudget: number;
  spentBudget: number;
  available: number;
};

type SpendCategory = {
  id: number;
  name: string;
  code: string;
};

export default function NewRequestPage() {
  const router = useRouter();
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState<
    string | null
  >(null);
  const [departments, setDepartments] =
    useState<Department[]>([]);
  const [categories, setCategories] =
    useState<SpendCategory[]>([]);

  const [title, setTitle] = useState("");
  const [vendorName, setVendorName] =
    useState("");
  const [departmentId, setDepartmentId] =
    useState("");
  const [categoryId, setCategoryId] =
    useState("");
  const [estimatedAmount, setEstimatedAmount] =
    useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetch("/api/proxy/departments")
      .then((r) => r.json())
      .then((d) =>
        setDepartments(d.departments ?? [])
      )
      .catch(() => {});

    fetch("/api/proxy/spend-categories")
    .then((r) => r.json())
    .then((d) =>
      setCategories(d.categories ?? [])
    )
    .catch(() => {});
  }, []);

  const selectedDept = departments.find(
    (d) => d.id === Number(departmentId)
  );

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setError(null);

    const amount = parseFloat(
      estimatedAmount
    );

    if (!Number.isFinite(amount) || amount < 0) {
      setError(
        "Enter a valid estimated cost"
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        "/api/proxy/purchase-requests",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            vendorName: vendorName.trim(),
            estimatedAmount: amount,
            description: reason.trim(),
            categoryId: Number(categoryId),
            departmentId: departmentId
              ? Number(departmentId)
              : undefined,
            requester: "Employee",
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Failed to submit request"
        );
      }

      router.push("/requests");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit request"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="New Purchase Request"
        description="Budget is checked before submission"
      />

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-surface p-8 shadow-card"
      >
        {error && (
          <div className="mb-6 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-foreground-subtle">
            Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-foreground-subtle">
            Department
          </label>
          <select
            required
            value={departmentId}
            onChange={(e) =>
              setDepartmentId(e.target.value)
            }
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
          >
            <option value="">
              Select department
            </option>
            {departments.map((d) => (
              <option
                key={d.id}
                value={d.id}
              >
                {d.name} (
                {formatMoney(d.available)}{" "}
                available)
              </option>
            ))}
          </select>
          {selectedDept && (
            <p className="mt-2 text-xs text-muted">
              Total:{" "}
              {formatMoney(selectedDept.budget)} ·
              Available:{" "}
              {formatMoney(selectedDept.available)} ·
              Reserved:{" "}
              {formatMoney(
                selectedDept.reservedBudget
              )}{" "}
              · Committed:{" "}
              {formatMoney(
                selectedDept.committedBudget
              )}{" "}
              · Spent:{" "}
              {formatMoney(selectedDept.spentBudget)}
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-foreground-subtle">
            Spend Category
          </label>
          <select
            required
            value={categoryId}
            onChange={(e) =>
              setCategoryId(e.target.value)
            }
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
          >
            <option value="">
              Select category
            </option>
            {categories.map((c) => (
              <option
                key={c.id}
                value={c.id}
              >
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-foreground-subtle">
            Vendor
          </label>
          <input
            type="text"
            required
            value={vendorName}
            onChange={(e) =>
              setVendorName(e.target.value)
            }
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-foreground-subtle">
            Estimated Cost
          </label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={estimatedAmount}
            onChange={(e) =>
              setEstimatedAmount(
                e.target.value
              )
            }
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        <div className="mb-8">
          <label className="mb-2 block text-sm font-medium text-foreground-subtle">
            Reason
          </label>
          <textarea
            required
            value={reason}
            onChange={(e) =>
              setReason(e.target.value)
            }
            rows={4}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        <Button
          type="submit"
          loading={loading}
          fullWidth
          size="lg"
          variant="primary"
        >
          {loading ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </PageContainer>
  );
}
