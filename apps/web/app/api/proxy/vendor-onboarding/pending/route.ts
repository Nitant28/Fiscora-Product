/**
 * GET /api/proxy/vendor-onboarding/pending
 * Purpose: List vendors awaiting onboarding review.
 * Data: Proxies to GET /vendor-onboarding/pending.
 * Roles: vendor.manage.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

async function authFetch(
  path: string,
  init?: RequestInit
) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("session")?.value;

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: token
        ? `Bearer ${token}`
        : "",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export async function GET() {
  const res = await authFetch(
    "/vendor-onboarding/pending"
  );
  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await authFetch(
    "/vendor-onboarding/invite",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
