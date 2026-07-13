"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@repo/ui/page-container";
import { Button } from "@repo/ui/button";
import ImportCsvForm from "../import/ImportCsvForm";

const STEPS = [
  "Company",
  "Departments",
  "Budgets",
  "Users",
  "Approval Rules",
  "Go Live",
] as const;

type OnboardingStatus = {
  tenant?: {
    name: string;
    industry?: string | null;
    currency?: string | null;
    timezone?: string | null;
    onboardingComplete?: boolean;
  };
  currentStep?: string;
  summary?: {
    departments: number;
    users: number;
    vendors: number;
    rules: number;
    totalBudget: number;
  };
  checklist?: Record<string, boolean>;
};

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [companyForm, setCompanyForm] = useState({
    name: "",
    industry: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
  });
  const [deptName, setDeptName] = useState("");
  const [departments, setDepartments] = useState<
    { id: number; name: string; budget: number }[]
  >([]);
  const [budgetEdits, setBudgetEdits] = useState<Record<number, string>>({});

  async function loadStatus() {
    const res = await fetch("/api/proxy/onboarding/status");
    const data = await res.json();
    if (res.ok) {
      setStatus(data);
      if (data.tenant) {
        setCompanyForm({
          name: data.tenant.name ?? "",
          industry: data.tenant.industry ?? "",
          currency: data.tenant.currency ?? "INR",
          timezone: data.tenant.timezone ?? "Asia/Kolkata",
        });
      }
    }

    const deptRes = await fetch("/api/proxy/departments");
    if (deptRes.ok) {
      const deptData = await deptRes.json();
      const list = deptData.departments ?? deptData ?? [];
      setDepartments(list);
      const edits: Record<number, string> = {};
      for (const d of list) {
        edits[d.id] = String(d.budget ?? 0);
      }
      setBudgetEdits(edits);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function saveCompany() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/proxy/onboarding/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(companyForm),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to save company");
      return;
    }
    setMessage("Company profile saved");
    setStep(1);
    await loadStatus();
  }

  async function addDepartment() {
    if (!deptName.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/proxy/onboarding/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: deptName.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to add department");
      return;
    }
    setDeptName("");
    await loadStatus();
  }

  async function saveBudgets() {
    setLoading(true);
    setError(null);
    for (const dept of departments) {
      const budget = Number(budgetEdits[dept.id]?.replace(/,/g, ""));
      if (!Number.isFinite(budget) || budget <= 0) {
        setLoading(false);
        setError(`Budget must be > 0 for ${dept.name}`);
        return;
      }
      const res = await fetch(
        `/api/proxy/onboarding/departments/${dept.id}/budget`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ budget }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setLoading(false);
        setError(data.error || `Failed to update ${dept.name}`);
        return;
      }
    }
    setLoading(false);
    setMessage("Budgets saved");
    setStep(3);
    await loadStatus();
  }

  async function applyRules(template: "small" | "medium" | "enterprise") {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/proxy/onboarding/approval-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to apply rules");
      return;
    }
    setMessage(`${template} company approval rules applied`);
    setStep(5);
    await loadStatus();
  }

  async function launch() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/proxy/onboarding/complete", {
      method: "POST",
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to complete onboarding");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <PageContainer width="narrow">
      <p className="text-sm font-medium uppercase tracking-wide text-primary">
        Customer Onboarding
      </p>
      <h1 className="mt-1 text-3xl font-bold text-foreground">Launch Fiscora in 15 minutes</h1>

      <div className="mt-8 flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={`focus-ring rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              step === index
                ? "bg-primary text-primary-fg"
                : "bg-muted-soft text-foreground-subtle hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-danger-border bg-danger-soft p-4 text-danger-fg">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-6 rounded-xl border border-success-border bg-success-soft p-4 text-success-fg">
          {message}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-card">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Company Setup</h2>
            <input
              className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
              placeholder="Company Name"
              value={companyForm.name}
              onChange={(e) =>
                setCompanyForm({ ...companyForm, name: e.target.value })
              }
            />
            <input
              className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
              placeholder="Industry (e.g. Manufacturing)"
              value={companyForm.industry}
              onChange={(e) =>
                setCompanyForm({ ...companyForm, industry: e.target.value })
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="Currency"
                value={companyForm.currency}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, currency: e.target.value })
                }
              />
              <input
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="Timezone"
                value={companyForm.timezone}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, timezone: e.target.value })
                }
              />
            </div>
            <Button
              type="button"
              loading={loading}
              onClick={saveCompany}
              size="lg"
              variant="primary"
            >
              Save & Continue
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Departments</h2>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
                placeholder="Department name"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
              />
              <Button
                type="button"
                loading={loading}
                onClick={addDepartment}
                variant="primary"
              >
                Add
              </Button>
            </div>
            <ul className="space-y-2">
              {departments.map((d) => (
                <li
                  key={d.id}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground"
                >
                  {d.name}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              onClick={() => setStep(2)}
              size="lg"
              variant="primary"
            >
              Continue to Budgets
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Budgets</h2>
            {departments.map((d) => (
              <div key={d.id} className="flex items-center gap-4">
                <span className="w-40 font-medium text-foreground">{d.name}</span>
                <input
                  className="flex-1 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-soft"
                  value={budgetEdits[d.id] ?? ""}
                  onChange={(e) =>
                    setBudgetEdits({ ...budgetEdits, [d.id]: e.target.value })
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              loading={loading}
              onClick={saveBudgets}
              size="lg"
              variant="primary"
            >
              Save Budgets
            </Button>
          </div>
        )}

        {step === 3 && (
          <div>
            <ImportCsvForm
              title="Import Users"
              description="Uses the same Import Center engine — no duplicate logic."
              endpoint="/api/proxy/onboarding/users/import"
              formatHint="name,email,role"
              sampleCsv={`name,email,role
John,john@corp.com,MANAGER
Jane,jane@corp.com,CFO`}
            />
            <Button
              type="button"
              onClick={() => setStep(4)}
              className="mt-4"
              size="lg"
              variant="primary"
            >
              Continue to Approval Rules
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Approval Rules</h2>
            <p className="text-sm text-muted">
              Pick a template based on company size. You can customize later.
            </p>
            <div className="grid gap-3">
              {(["small", "medium", "enterprise"] as const).map((template) => (
                <button
                  key={template}
                  type="button"
                  disabled={loading}
                  onClick={() => applyRules(template)}
                  className="focus-ring rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-surface-subtle disabled:opacity-50"
                >
                  <span className="font-medium capitalize text-foreground">{template} company</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Go Live</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-surface-subtle p-4">
                <p className="text-sm text-muted">Departments</p>
                <p className="text-2xl font-bold text-foreground">
                  {status?.summary?.departments ?? departments.length}
                </p>
              </div>
              <div className="rounded-lg bg-surface-subtle p-4">
                <p className="text-sm text-muted">Users</p>
                <p className="text-2xl font-bold text-foreground">{status?.summary?.users ?? 0}</p>
              </div>
              <div className="rounded-lg bg-surface-subtle p-4">
                <p className="text-sm text-muted">Vendors</p>
                <p className="text-2xl font-bold text-foreground">
                  {status?.summary?.vendors ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-surface-subtle p-4">
                <p className="text-sm text-muted">Approval Rules</p>
                <p className="text-2xl font-bold text-foreground">{status?.summary?.rules ?? 0}</p>
              </div>
            </div>
            <p className="text-lg font-medium text-foreground">
              Total Budget:{" "}
              {formatInr(status?.summary?.totalBudget ?? 0)}
            </p>
            <Button
              type="button"
              loading={loading}
              onClick={launch}
              size="lg"
              className="bg-success text-white hover:bg-success/90"
            >
              Launch Fiscora
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
