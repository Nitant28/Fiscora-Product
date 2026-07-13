/**
 * POST /api/proxy/access-request
 * Purpose: Submit a workspace access request (signed in via Clerk, not provisioned).
 * Data: Proxies to POST /access-request, forwarding the Clerk token.
 */
import { NextResponse } from "next/server";
import { API_BASE, getProxyAuthHeaders } from "../../../../lib/proxyAuth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const res = await fetch(`${API_BASE}/access-request`, {
    method: "POST",
    headers: await getProxyAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
