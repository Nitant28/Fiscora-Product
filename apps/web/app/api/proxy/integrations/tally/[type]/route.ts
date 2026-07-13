/**
 * GET /api/proxy/integrations/tally/[type] — CSV download or JSON preview
 */
import { NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET(
  request: Request,
  context: { params: Promise<{ type: string }> }
) {
  const { type } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";
  const query = searchParams.toString();

  const res = await fetch(
    `${API_BASE}/integrations/tally/${type}${query ? `?${query}` : ""}`,
    {
      headers: await getProxyAuthHeaders(),
      cache: "no-store",
    }
  );

  if (format === "csv") {
    const csv = await res.text();
    const disposition =
      res.headers.get("Content-Disposition") ??
      `attachment; filename="fiscora-tally-${type}.csv"`;

    return new NextResponse(csv, {
      status: res.status,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": disposition,
      },
    });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
