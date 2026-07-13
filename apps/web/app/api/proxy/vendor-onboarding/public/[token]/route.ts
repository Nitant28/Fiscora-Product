/**
 * GET /api/proxy/vendor-onboarding/public/:token
 * Purpose: Load public onboarding form state for invite token.
 * Data: Proxies to GET /vendor-onboarding/:token (no auth).
 * Roles: Public invitee.
 */
import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ token: string }>;
  }
) {
  const { token } = await params;

  const res = await fetch(
    `${API_BASE}/vendor-onboarding/${token}`,
    { cache: "no-store" }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
