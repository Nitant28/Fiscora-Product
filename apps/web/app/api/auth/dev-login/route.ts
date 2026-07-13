/**
 * POST   /api/auth/dev-login   { email }   → set dev session cookie (DEV ONLY)
 * DELETE /api/auth/dev-login                → clear dev session cookie
 *
 * Disabled entirely unless NODE_ENV!=production AND FISCORA_DEV_AUTH=true.
 * Backed by the legacy session the Fiscora API already understands; Clerk is
 * untouched and remains the sole auth in production.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE } from "../../../../lib/api";
import {
  isDevAuthEnabled,
  DEV_SESSION_COOKIE,
} from "../../../../lib/devAuth";

export async function POST(request: Request) {
  if (!isDevAuthEnabled()) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email =
    typeof body.email === "string" ? body.email : "";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Cannot reach Fiscora API. Start it with: pnpm --filter api dev",
      },
      { status: 503 }
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    return NextResponse.json(
      { success: false, error: data.error ?? "Dev login failed" },
      { status: res.status || 400 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(DEV_SESSION_COOKIE, data.token, {
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

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEV_SESSION_COOKIE)?.value;

  if (token) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  cookieStore.delete(DEV_SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
