/**
 * GET/POST /api/proxy/billing/*
 * Purpose: Proxy billing endpoints to the Fiscora API.
 */
import { NextResponse } from "next/server";
import { API_BASE, getProxyAuthHeaders } from "@/lib/proxyAuth";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(
  request: Request,
  pathSegments: string[],
  method: string
) {
  const path = pathSegments.join("/");
  const { search } = new URL(request.url);
  const body =
    method === "GET" || method === "DELETE"
      ? undefined
      : await request.text();

  const res = await fetch(`${API_BASE}/billing/${path}${search}`, {
    method,
    headers: await getProxyAuthHeaders(
      body ? { "Content-Type": "application/json" } : {}
    ),
    body: body || undefined,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { path } = await params;
  return proxy(_req, path, "GET");
}

export async function POST(req: Request, { params }: Ctx) {
  const { path } = await params;
  return proxy(req, path, "POST");
}
