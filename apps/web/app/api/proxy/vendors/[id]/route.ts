/**
 * GET/PATCH /api/proxy/vendors/:id
 * Purpose: Vendor detail and payment-terms updates from the browser.
 * Data: Proxies to /vendors/:id.
 * Roles: vendor.view, vendor.manage.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

export async function PATCH(
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
    `${API_BASE}/vendors/${id}`,
    {
      method: "PATCH",
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
