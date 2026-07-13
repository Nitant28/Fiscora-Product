/**
 * Audit Center (Sprint 24)
 * Purpose: Searchable, filterable forensic log of every protected action, with
 * CSV export for compliance. Data: GET /audit/logs, /audit/facets (apiFetch).
 * Roles: audit.view (export requires audit.export).
 */
import { apiFetch } from "../../../lib/api";
import AuditCenterClient from "./AuditCenterClient";

type Facets = {
  entityTypes: string[];
  actions: string[];
};

async function getFacets(): Promise<Facets> {
  const res = await apiFetch("/audit/facets");
  if (!res.ok) return { entityTypes: [], actions: [] };
  const data = await res.json();
  return {
    entityTypes: data.entityTypes ?? [],
    actions: data.actions ?? [],
  };
}

export default async function AuditCenterPage() {
  const facets = await getFacets();
  return (
    <AuditCenterClient
      entityTypes={facets.entityTypes}
      actions={facets.actions}
    />
  );
}
