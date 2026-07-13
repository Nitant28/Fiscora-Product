/**
 * POST /api/proxy/purchase-requests/:id/generate-po
 * Purpose: Generate a PO from an approved purchase request.
 * Data: Proxies to POST /purchase-requests/:id/generate-po.
 * Roles: po.create, request.approve.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://127.0.0.1:4000";

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const body = await request.text();

  const res = await fetch(`${API_BASE}/purchase-requests/${id}/generate-po`, {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body,
  });

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
