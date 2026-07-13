import { NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET() {
  const res = await fetch(`${API_BASE}/settings/api-keys`, {
    headers: await getProxyAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${API_BASE}/settings/api-keys`, {
    method: "POST",
    headers: await getProxyAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
