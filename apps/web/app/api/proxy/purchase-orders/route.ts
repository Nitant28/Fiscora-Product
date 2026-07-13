/**
 * GET /api/proxy/purchase-orders
 * Purpose: List purchase orders for the web UI.
 * Data: Proxies to GET /purchase-orders.
 * Roles: po.view.
 */
import { NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET() {
  const res = await fetch(
    `${API_BASE}/purchase-orders`,
    {
      headers: await getProxyAuthHeaders(),
      cache: "no-store",
    }
  );

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
