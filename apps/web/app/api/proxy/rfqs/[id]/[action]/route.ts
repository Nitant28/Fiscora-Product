/**
 * POST /api/proxy/rfqs/:id/:action
 * Purpose: RFQ actions — bids, award, generate PO, publish, close.
 * Data: Proxies to POST /rfqs/:id/:action.
 * Roles: rfq.manage, rfq.award.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://localhost:4000";

async function getAuthHeaders(
  includeJson = false
) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("session")?.value;

  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

export async function POST(
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

  const validActions = [
    "bids",
    "score",
    "open",
    "award",
    "generate-po",
  ];

  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  }

  const path = `/rfqs/${id}/${action}`;
  const hasBody =
    action === "bids" || action === "award";

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: await getAuthHeaders(hasBody),
    body: hasBody
      ? await request.text()
      : undefined,
  });

  const data = await res.json();
  return NextResponse.json(data, {
    status: res.status,
  });
}
