/**
 * POST /api/proxy/vendor-onboarding/review/:vendorId/activate
 * Purpose: Activate a reviewed vendor into the approved directory.
 * Data: Proxies to POST /vendor-onboarding/review/:vendorId/activate.
 * Roles: vendor.manage.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ vendorId: string }>;
  }
) {
  const { vendorId } = await params;
  const cookieStore = await cookies();
  const token =
    cookieStore.get("session")?.value;

  const res = await fetch(
    `${API_BASE}/vendor-onboarding/review/${vendorId}/activate`,
    {
      method: "PATCH",
      headers: {
        Authorization: token
          ? `Bearer ${token}`
          : "",
        "Content-Type": "application/json",
      },
      body: await request.text(),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
