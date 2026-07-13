import { NextRequest, NextResponse } from "next/server";
import { vendorApiFetch } from "../../../../../lib/vendorApi";

export async function GET() {
  const res = await vendorApiFetch("/vendor/profile");
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const res = await vendorApiFetch("/vendor/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
