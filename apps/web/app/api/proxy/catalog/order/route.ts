/**
 * POST /api/proxy/catalog/order
 * Purpose: Place a catalog order (creates request/PO flow).
 * Data: Proxies to POST /catalog/order.
 * Roles: catalog.manage or employee catalog access.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("session")?.value;
  const body = await request.json();

  const res = await fetch(
    `${API_BASE}/catalog/order`,
    {
      method: "POST",
      headers: {
        Authorization: token
          ? `Bearer ${token}`
          : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
