import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const res = await fetch(
    `${API_BASE}/users/invite`,
    {
      method: "POST",
      headers: await getProxyAuthHeaders({
        "Content-Type": "application/json",
      }),
      body,
      cache: "no-store",
    }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
