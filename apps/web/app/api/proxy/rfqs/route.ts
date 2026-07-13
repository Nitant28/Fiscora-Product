/**
 * GET/POST /api/proxy/rfqs
 * Purpose: List RFQs or create a new sourcing event.
 * Data: Proxies to /rfqs.
 * Roles: rfq.view, rfq.create.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

async function getAuthHeaders(
  includeJson = false
) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("session")?.value;

  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

export async function GET() {
  const res = await fetch(`${API_BASE}/rfqs`, {
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  const res = await fetch(`${API_BASE}/rfqs`, {
    method: "POST",
    headers: await getAuthHeaders(true),
    body,
  });

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
