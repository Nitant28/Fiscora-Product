/**
 * GET/POST /api/proxy/purchase-requests
 * Purpose: List or create purchase requests from client components.
 * Data: Proxies to /purchase-requests.
 * Roles: request.view, request.create.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET() {
  const res = await fetch(
    `${API_BASE}/purchase-requests`,
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

export async function POST(request: NextRequest) {
  const body = await request.text();
  const res = await fetch(
    `${API_BASE}/purchase-requests`,
    {
      method: "POST",
      headers: {
        ...(await getProxyAuthHeaders()),
        "Content-Type": "application/json",
      },
      body,
    }
  );

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
