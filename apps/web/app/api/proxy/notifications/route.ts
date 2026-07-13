/**
 * GET /api/proxy/notifications
 * Purpose: List user notifications for the notification center.
 * Data: Proxies to GET /notifications.
 */
import { NextResponse } from "next/server";
import { API_BASE, getProxyAuthHeaders } from "../../../../lib/proxyAuth";

export async function GET() {
  const res = await fetch(`${API_BASE}/notifications`, {
    headers: await getProxyAuthHeaders(),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
