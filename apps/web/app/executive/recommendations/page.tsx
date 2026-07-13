import Link from "next/link";
import { PageContainer } from "@repo/ui/page-container";
import { PageHeader } from "@repo/ui/page-header";
import { Button } from "@repo/ui/button";
import { apiFetch } from "../../../lib/api";

type Recommendation = {
  id: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  title: string;
  recommendation: string;
  impact: string;
  contractId?: number;
  vendorName?: string;
  action?: string;
};

const SEVERITY_STYLE = {
  HIGH: "border-red-200 bg-red-50 text-red-800",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-900",
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

async function getRecommendations() {
  const res = await apiFetch("/executive/recommendations");

  if (!res.ok) {
    return null;
  }

  return res.json() as Promise<{
    recommendations: Recommendation[];
    generatedAt: string;
  }>;
}

export default async function ExecutiveRecommendationsPage() {
  const data = await getRecommendations().catch(() => null);

  if (!data?.recommendations) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Executive Recommendations" />
        <div className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          Unable to load recommendations. Ensure the API is running.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Executive Recommendations"
        description="Prioritized actions with estimated impact — what to do next."
        actions={
          <Link href="/contracts/intelligence">
            <Button variant="outline">Contract Action Center</Button>
          </Link>
        }
      />

      <div className="space-y-4">
        {data.recommendations.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[item.severity]}`}
                >
                  {item.severity}
                </span>
                <span className="ml-2 text-xs uppercase tracking-wide text-gray-400">
                  {item.category}
                </span>
                <h2 className="mt-3 text-lg font-semibold text-gray-900">
                  {item.title}
                </h2>
              </div>
              {item.contractId && (
                <Link
                  href={`/contracts/${item.contractId}`}
                  className="text-sm font-medium text-indigo-700 hover:underline"
                >
                  View contract
                </Link>
              )}
            </div>

            <p className="mt-3 text-sm text-gray-700">
              {item.recommendation}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm font-medium text-gray-900">
                Potential impact: {item.impact}
              </p>
              {item.vendorName && (
                <p className="text-xs text-gray-500">
                  Vendor: {item.vendorName}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </PageContainer>
  );
}
