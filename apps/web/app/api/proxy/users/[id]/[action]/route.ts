import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

// PATCH actions mutate a field; POST actions trigger a lifecycle operation.
const PATCH_ACTIONS = ["status", "role", "department"];
const POST_ACTIONS = [
  "resend",
  "cancel-invitation",
  "force-logout",
];

async function forward(
  request: NextRequest,
  id: string,
  action: string,
  method: "PATCH" | "POST"
) {
  const body = await request.text();
  const res = await fetch(
    `${API_BASE}/users/${id}/${action}`,
    {
      method,
      headers: await getProxyAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: body || undefined,
      cache: "no-store",
    }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
  if (!PATCH_ACTIONS.includes(action)) {
    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  }
  return forward(request, id, action, "PATCH");
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
  if (!POST_ACTIONS.includes(action)) {
    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  }
  return forward(request, id, action, "POST");
}
