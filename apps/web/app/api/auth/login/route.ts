/**
 * POST /api/auth/login
 * Purpose: Authenticate credentials and set httpOnly session cookie.
 * Data: Proxies to POST /auth/login on Fiscora API.
 * Roles: Public.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE } from "../../../../lib/api";

export async function POST(request: NextRequest) {
  const body = await request.json();

  let res: Response;

  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Cannot reach Fiscora API. Start it with: cd apps/api && pnpm dev",
      },
      { status: 503 }
    );
  }

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(data, {
      status: res.status,
    });
  }

  const cookieStore = await cookies();
  cookieStore.set("session", data.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({
    success: true,
    user: data.user,
  });
}
