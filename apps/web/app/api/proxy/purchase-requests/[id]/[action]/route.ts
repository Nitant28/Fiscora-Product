/**
 * POST /api/proxy/purchase-requests/:id/:action
 * Purpose: Approve, reject, or other request workflow actions.
 * Data: Proxies to POST /purchase-requests/:id/:action.
 * Roles: request.approve.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

async function proxyRequest(
  request: NextRequest,
  path: string
) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("session")?.value;

  const res = await fetch(`${API_BASE}${path}`, {
    method: request.method,
    headers: {
      Authorization: token
        ? `Bearer ${token}`
        : "",
    },
  });

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}

export async function PATCH(
  request: NextRequest,
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

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  }

  return proxyRequest(
    request,
    `/purchase-requests/${id}/${action}`
  );
}
