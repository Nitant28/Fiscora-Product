/**
 * Developer / API Platform (Sprint 27)
 * Purpose: Create, view, and revoke tenant-scoped API keys for integrations.
 * Data: GET /settings/api-keys, /settings/api-keys/scopes (apiFetch).
 * Roles: apikey.manage (admin).
 */
import { apiFetch } from "../../../lib/api";
import DeveloperClient from "./DeveloperClient";

type ApiKey = {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdByName: string | null;
  createdAt: string;
};

async function getKeys(): Promise<ApiKey[]> {
  const res = await apiFetch("/settings/api-keys");
  if (!res.ok) return [];
  const data = await res.json();
  return data.keys ?? [];
}

async function getScopes(): Promise<string[]> {
  const res = await apiFetch("/settings/api-keys/scopes");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.scopes ?? []).map((s: { key: string }) => s.key);
}

export default async function DeveloperPage() {
  const [keys, scopes] = await Promise.all([getKeys(), getScopes()]);
  return <DeveloperClient initialKeys={keys} scopes={scopes} />;
}
