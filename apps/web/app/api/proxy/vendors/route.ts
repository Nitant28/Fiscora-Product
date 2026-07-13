/**
 * GET /api/proxy/vendors
 * Purpose: Vendor directory for client-side selects and lists.
 * Data: Proxies to GET /vendors.
 * Roles: vendor.view.
 */
import { NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET() {
  const res = await fetch(`${API_BASE}/vendors`, {
    headers: await getProxyAuthHeaders(),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
