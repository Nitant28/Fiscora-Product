import { apiFetch } from "./api";

export interface AuditSummary {
  totalEvents: number;
  approvals: number;
  violations: number;
  fraudAlerts: number;
}

export interface AuditFraudSummary {
  duplicateInvoices: number;
  splitPurchases: number;
}

export interface AuditRiskSummary {
  highRiskVendors: number;
  expiringContracts: number;
}

export interface AuditEvent {
  id: string;
  actorRole: string | null;
  action: string;
  permission: string | null;
  createdAt: string;
}

export async function getAuditSummary(): Promise<AuditSummary> {
  const res = await apiFetch("/audit/summary");

  if (!res.ok) {
    const body = await res.text();

    throw new Error(
      `Audit summary failed.
Status: ${res.status}
Body: ${body}`
    );
  }

  return res.json();
}

export async function getAuditEvents() {
  const res = await apiFetch("/audit/events");

  if (!res.ok) {
    const body = await res.text();

    throw new Error(
      `Audit events failed.
Status: ${res.status}
Body: ${body}`
    );
  }

  return res.json();
}

export async function getAuditFraud(): Promise<AuditFraudSummary> {
  const res = await apiFetch("/audit/fraud");

  if (!res.ok) {
    const body = await res.text();

    throw new Error(
      `Audit fraud failed.
Status: ${res.status}
Body: ${body}`
    );
  }

  return res.json();
}

export async function getAuditRisks(): Promise<AuditRiskSummary> {
  const res = await apiFetch("/audit/risks");

  if (!res.ok) {
    const body = await res.text();

    throw new Error(
      `Audit risks failed.
Status: ${res.status}
Body: ${body}`
    );
  }

  return res.json();
}