/**
 * GET/PATCH /api/proxy/purchase-orders/:id
 * Purpose: Fetch or update a single purchase order.
 * Data: Proxies to /purchase-orders/:id.
 * Roles: po.view, po.manage.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;

  const res = await fetch(
    `${API_BASE}/purchase-orders/${id}`,
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

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;
  const body = await request.json();
  const action = body?.action;

  if (
    !["send", "accept", "close"].includes(action)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Unsupported PO action",
      },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${API_BASE}/purchase-orders/${id}/${action}`,
    {
      method: "PATCH",
      headers: await getProxyAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
