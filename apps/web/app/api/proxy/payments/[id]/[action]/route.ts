/**
 * POST /api/proxy/payments/:id/:action
 * Purpose: Transition payment state (approve, schedule, process, complete, etc.).
 * Data: Proxies to POST /payments/:id/:action.
 * Roles: payment.approve, payment.process.
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

export async function POST(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      action: string;
    }>;
  }
) {
  const { id, action } = await params;

  const validActions = [
    "ready",
    "process",
    "pay",
  ];

  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${API_BASE}/payments/${id}/${action}`,
    {
      method: "POST",
      headers: await getAuthHeaders(),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
