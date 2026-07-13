import { NextResponse } from "next/server";
import { vendorApiFetch } from "../../../../../lib/vendorApi";

export async function GET() {
  const res = await vendorApiFetch("/vendor/dashboard");
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
