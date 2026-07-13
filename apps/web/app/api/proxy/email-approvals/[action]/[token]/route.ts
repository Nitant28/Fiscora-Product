/**
 * POST /api/proxy/email-approvals/[action]/[token]
 */
import { NextResponse } from "next/server";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://127.0.0.1:4000";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ action: string; token: string }>;
  }
) {
  const { action, token } = await context.params;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${API_BASE}/email-approvals/${action}/${token}`,
    { method: "POST" }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
