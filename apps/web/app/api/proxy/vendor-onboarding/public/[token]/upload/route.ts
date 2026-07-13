/**
 * POST /api/proxy/vendor-onboarding/public/:token/upload
 * Purpose: Upload compliance documents during vendor self-onboarding.
 * Data: Proxies to POST /vendor-onboarding/:token/upload.
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
  const form = await request.formData();

  const res = await fetch(
    `${API_BASE}/vendor-onboarding/${token}/upload`,
    {
      method: "POST",
      body: form,
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
