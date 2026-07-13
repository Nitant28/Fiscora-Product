/**
 * POST /api/proxy/documents/:id/correct
 * Purpose: Submit corrected extraction fields for a document.
 * Data: Proxies to POST /documents/:id/correct.
 * Roles: invoice.approve.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;

  const res = await fetch(
    `${API_BASE}/documents/${id}/correct`,
    {
      method: "PATCH",
      headers: await getProxyAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: await request.text(),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
