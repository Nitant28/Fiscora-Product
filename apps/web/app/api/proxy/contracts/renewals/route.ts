import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET(_request: NextRequest) {
  const res = await fetch(
    `${API_BASE}/contracts/renewals`,
    {
      headers: await getProxyAuthHeaders(),
      cache: "no-store",
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
