/**
 * POST /api/auth/logout
 * Purpose: Clear session cookie and end user session.
 * Data: Local cookie only (optional API logout).
 * Roles: Authenticated users.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("session");

  return NextResponse.json({ success: true });
}
