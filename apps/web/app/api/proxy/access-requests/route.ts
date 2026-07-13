/**
 * GET /api/proxy/access-requests
 * Purpose: List access requests for admin review.
 * Data: Proxies to GET /access-requests.
 */
import { NextResponse } from "next/server";
import { API_BASE, getProxyAuthHeaders } from "../../../../lib/proxyAuth";

export async function GET(request: Request) {
  const { search } = new URL(request.url);

  const res = await fetch(`${API_BASE}/access-requests${search}`, {
    headers: await getProxyAuthHeaders(),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
