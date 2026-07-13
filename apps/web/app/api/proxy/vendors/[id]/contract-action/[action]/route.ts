import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

const VALID_ACTIONS = [
  "find-alternatives",
  "create-rfq",
  "vendor-benchmark",
];

export async function POST(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; action: string }>;
  }
) {
  const { id, action } = await params;

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${API_BASE}/vendors/${id}/contract-action/${action}`,
    {
      method: "POST",
      headers: await getProxyAuthHeaders(),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
