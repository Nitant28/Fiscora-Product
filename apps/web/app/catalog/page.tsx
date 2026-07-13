/**
 * Catalog
 * Purpose: Internal catalog browse and one-click ordering for approved SKUs.
 * Data: GET /catalog (apiFetch); orders via CatalogClient proxy.
 * Roles: Employees and procurement with catalog access.
 */
import { apiFetch } from "../../lib/api";
import CatalogClient from "./CatalogClient";

export default async function CatalogPage() {
  const res = await apiFetch("/catalog");
  const data = res.ok ? await res.json() : { items: [] };

  return (
    <CatalogClient items={data.items ?? []} />
  );
}
