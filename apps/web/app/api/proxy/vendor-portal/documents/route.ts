import { NextRequest, NextResponse } from "next/server";
import { getVendorSessionToken, API_BASE } from "../../../../../lib/vendorApi";

export async function POST(request: NextRequest) {
  const token = await getVendorSessionToken();
  const formData = await request.formData();

  const res = await fetch(`${API_BASE}/vendor/documents`, {
    method: "POST",
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : undefined,
    body: formData,
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
