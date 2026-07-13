/**
 * GET /api/proxy/documents
 * Purpose: List invoices/documents with optional search and status query params.
 * Data: Proxies to GET /documents.
 * Roles: Session Bearer (invoice.view enforced on API).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET(
  request: NextRequest
) {
  const search =
    request.nextUrl.searchParams.toString();
  const url = search
    ? `${API_BASE}/documents?${search}`
    : `${API_BASE}/documents`;

  const res = await fetch(url, {
    headers: await getProxyAuthHeaders(),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
