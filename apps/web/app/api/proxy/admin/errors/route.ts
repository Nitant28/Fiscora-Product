import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit") ?? "50";
  const cursor = request.nextUrl.searchParams.get("cursor");
  const query = new URLSearchParams({ limit });

  if (cursor) {
    query.set("cursor", cursor);
  }

  const res = await fetch(
    `${API_BASE}/admin/errors?${query.toString()}`,
    {
      headers: await getProxyAuthHeaders(),
      cache: "no-store",
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
