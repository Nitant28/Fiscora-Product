/**
 * POST /api/proxy/access-requests/:id/:action  (approve | reject)
 * Purpose: Review an access request.
 * Data: Proxies to POST /access-requests/:id/{approve|reject}.
 */
import { NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "../../../../../../lib/proxyAuth";

const ALLOWED = new Set(["approve", "reject"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;

  if (!ALLOWED.has(action)) {
    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));

  const res = await fetch(
    `${API_BASE}/access-requests/${id}/${action}`,
    {
      method: "POST",
      headers: await getProxyAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
