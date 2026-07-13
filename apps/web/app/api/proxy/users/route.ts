import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search;
  const res = await fetch(
    `${API_BASE}/users${qs}`,
    {
      headers: await getProxyAuthHeaders(),
      cache: "no-store",
    }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
