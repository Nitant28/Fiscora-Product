/**
 * GET/POST /api/proxy/payments
 * Purpose: List or create payments in the payment engine.
 * Data: Proxies to /payments.
 * Roles: payment.view, payment.process.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("session")?.value;

  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function GET() {
  const res = await fetch(
    `${API_BASE}/payments`,
    {
      headers: await getAuthHeaders(),
      cache: "no-store",
    }
  );

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
