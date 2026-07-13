/**
 * Vendor portal API client (separate session from employee auth).
 */
import { cookies } from "next/headers";

export const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://127.0.0.1:4000";

export async function getVendorSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get("vendor_session")?.value;
}

export async function vendorApiFetch(
  path: string,
  options: RequestInit = {}
) {
  const token = await getVendorSessionToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    options.body &&
    !headers.has("Content-Type") &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
}

export async function getVendorPortalUser() {
  const res = await vendorApiFetch("/vendor/profile");
  if (!res.ok) return null;
  const data = await res.json();
  return data.profile ?? null;
}
