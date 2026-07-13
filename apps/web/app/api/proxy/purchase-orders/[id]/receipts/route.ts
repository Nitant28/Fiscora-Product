/**
 * POST /api/proxy/purchase-orders/:id/receipts
 * Purpose: Record goods receipt against PO lines.
 * Data: Proxies to POST /purchase-orders/:id/receipts.
 * Roles: po.receive.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token =
    cookieStore.get("session")?.value;

  const res = await fetch(
    `${API_BASE}/purchase-orders/${id}/receipts`,
    {
      method: "POST",
      headers: {
        Authorization: token
          ? `Bearer ${token}`
          : "",
        "Content-Type": "application/json",
      },
      body: await request.text(),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
