import { NextRequest, NextResponse } from "next/server";
import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search;

  const res = await fetch(
    `${API_BASE}/audit-logs/export${qs}`,
    {
      headers: await getProxyAuthHeaders(),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to export audit logs" },
      { status: res.status }
    );
  }

  const csv = await res.text();
  const disposition =
    res.headers.get("content-disposition") ??
    'attachment; filename="audit-log.csv"';

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": disposition,
    },
  });
}
