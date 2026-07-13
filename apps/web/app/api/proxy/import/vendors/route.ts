import { NextRequest, NextResponse } from "next/server";
import { API_BASE, getProxyAuthHeaders } from "@/lib/proxyAuth";

async function forwardImport(
  request: NextRequest,
  path: string
) {
  const body = await request.json();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      ...(await getProxyAuthHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  return forwardImport(request, "/import/vendors");
}
