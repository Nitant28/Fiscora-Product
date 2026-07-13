import { NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const res = await fetch(
    `${API_BASE}/admin/rbac/matrix/toggle`,
    {
      method: "POST",
      headers: await getProxyAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
