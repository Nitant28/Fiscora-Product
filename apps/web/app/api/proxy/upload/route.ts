/**
 * POST /api/proxy/upload
 * Purpose: Multipart invoice file upload for extraction queue.
 * Data: Proxies to POST /upload.
 * Roles: invoice.upload.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function POST(request: NextRequest) {
  const form = await request.formData();

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: await getProxyAuthHeaders(),
    body: form,
  });

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
