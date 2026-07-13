/**
 * PATCH /api/proxy/notifications/read-all
 * Purpose: Mark all notifications as read.
 * Data: Proxies to PATCH /notifications/read-all.
 */
import { NextResponse } from "next/server";
import { API_BASE, getProxyAuthHeaders } from "../../../../../lib/proxyAuth";

export async function PATCH() {
  const res = await fetch(`${API_BASE}/notifications/read-all`, {
    method: "PATCH",
    headers: await getProxyAuthHeaders(),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
