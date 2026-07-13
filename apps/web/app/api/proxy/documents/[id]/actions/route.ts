/**
 * POST /api/proxy/documents/:id/actions
 * Purpose: Invoice workflow actions (approve, reject, mark paid).
 * Data: Proxies to POST /documents/:id/actions.
 * Roles: invoice.approve.
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
    `${API_BASE}/documents/${id}/actions`,
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
