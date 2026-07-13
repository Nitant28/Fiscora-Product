"use client";

/**
 * New RFQ
 * Purpose: Create a request-for-quote from an approved purchase request.
 * Data: POST /api/proxy/rfqs → POST /rfqs.
 * Roles: rfq.create, rfq.manage.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";

type SpendCategory = {
  id: number;
  name: string;
  code: string;
};

export default function NewRFQPage() {
  const router = useRouter();
  const [loading, setLoading] =
    useState(false);
  const [error, setError] = useState<
    string | null
  >(null);
  const [categories, setCategories] =
    useState<SpendCategory[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");
  const [categoryId, setCategoryId] =
    useState("");

  useEffect(() => {
    fetch(
      "/api/proxy/spend-categories"
    )
      .then((r) => r.json())
      .then((d) =>
        setCategories(d.categories ?? [])
      )
      .catch(() => {});
  }, []);

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        "/api/proxy/rfqs",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            description:
              description.trim() || undefined,
            categoryId: Number(categoryId),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Failed to create RFQ"
        );
      }

      router.push(`/rfqs/${data.rfq.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create RFQ"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Create RFQ"
        description="Start a competitive sourcing event"
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
            placeholder="Dell Laptop Procurement"
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-foreground-subtle">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            rows={4}
            placeholder="100 laptops for Engineering team"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        <div className="mb-8">
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

        <Button
          type="submit"
          loading={loading}
          fullWidth
          size="lg"
          variant="primary"
        >
          {loading ? "Creating..." : "Create RFQ"}
        </Button>
      </form>
    </PageContainer>
  );
}
