import {
  API_BASE,
  getProxyAuthHeaders,
} from "@/lib/proxyAuth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const res = await fetch(
    `${API_BASE}/audit/export?${searchParams.toString()}`,
    {
      headers: await getProxyAuthHeaders(),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return new Response(text, { status: res.status });
  }

  const csv = await res.text();
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        res.headers.get("content-disposition") ??
        'attachment; filename="audit-log.csv"',
    },
  });
}
