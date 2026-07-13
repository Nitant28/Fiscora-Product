import { NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(`${API_BASE}/settings/api-keys/${id}`, {
    method: "DELETE",
    headers: await getProxyAuthHeaders(),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
