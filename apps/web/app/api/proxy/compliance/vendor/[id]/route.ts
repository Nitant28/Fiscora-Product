/**
 * GET /api/proxy/compliance/vendor/[id]
 */
import { NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const res = await fetch(
    `${API_BASE}/compliance/vendor/${id}`,
    {
      headers: await getProxyAuthHeaders(),
      cache: "no-store",
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
