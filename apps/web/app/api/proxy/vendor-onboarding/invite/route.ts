/**
 * POST /api/proxy/vendor-onboarding/invite
 * Purpose: Send vendor onboarding invite with magic link token.
 * Data: Proxies to POST /vendor-onboarding/invite.
 * Roles: vendor.invite.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("session")?.value;
  const body = await request.json();

  const res = await fetch(
    `${API_BASE}/vendor-onboarding/invite`,
    {
      method: "POST",
      headers: {
        Authorization: token
          ? `Bearer ${token}`
          : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
