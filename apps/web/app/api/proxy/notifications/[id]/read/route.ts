/**
 * PATCH /api/proxy/notifications/:id/read
 * GET — legacy redirect from notifications page links.
 */
import { NextResponse } from "next/server";
import { API_BASE, getProxyAuthHeaders } from "../../../../../../lib/proxyAuth";

async function markRead(id: string) {
  return fetch(`${API_BASE}/notifications/${id}/read`, {
    method: "PATCH",
    headers: await getProxyAuthHeaders(),
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await markRead(id);
  return NextResponse.redirect(
    new URL("/notifications", "http://localhost:3000")
  );
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await markRead(id);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
