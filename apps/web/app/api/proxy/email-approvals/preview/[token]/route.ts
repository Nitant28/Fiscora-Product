/**
 * GET /api/proxy/email-approvals/preview/[token]
 */
import { NextResponse } from "next/server";

const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://127.0.0.1:4000";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const res = await fetch(
    `${API_BASE}/email-approvals/preview/${token}`,
    { cache: "no-store" }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
