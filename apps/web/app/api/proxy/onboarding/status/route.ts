import { NextResponse } from "next/server";
import { API_BASE, getProxyAuthHeaders } from "@/lib/proxyAuth";

export async function GET() {
  const res = await fetch(`${API_BASE}/onboarding/status`, {
    headers: await getProxyAuthHeaders(),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
