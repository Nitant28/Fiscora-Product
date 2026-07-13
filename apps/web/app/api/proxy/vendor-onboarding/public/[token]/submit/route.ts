/**
 * POST /api/proxy/vendor-onboarding/public/:token/submit
 * Purpose: Submit completed vendor onboarding application.
 * Data: Proxies to POST /vendor-onboarding/:token/submit.
 * Roles: Public invitee.
 */
import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ token: string }>;
  }
) {
  const { token } = await params;
  const body = await request.json();

  const res = await fetch(
    `${API_BASE}/vendor-onboarding/${token}/submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
