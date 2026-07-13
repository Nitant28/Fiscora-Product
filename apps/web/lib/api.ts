/**
 * Server-side API client for the Fiscora backend.
 * Auth: Clerk JWT only — no legacy session cookie fallback.
 */
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { resolveUserPermissions } from "./permissions";
import { isDevAuthEnabled, DEV_SESSION_COOKIE } from "./devAuth";

export const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://127.0.0.1:4000";

export type FiscoraUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  tenantId: number;
  permissions?: string[];
  department?: { id: number; name: string } | null;
  [key: string]: unknown;
};

export type AuthState =
  | {
      status: "authenticated";
      user: NonNullable<FiscoraUser>;
      isDevSession: boolean;
    }
  | { status: "not_provisioned" }
  | { status: "unauthenticated" };

/**
 * Returns the bearer token for backend auth.
 * Production: Clerk session JWT only. Development (FISCORA_DEV_AUTH): an explicit
 * dev session cookie (chosen at /dev-login) takes precedence, so picking a demo
 * account always wins over a lingering (e.g. unprovisioned) Clerk session.
 */
export async function getSessionToken() {
  if (isDevAuthEnabled()) {
    const devToken = (await cookies()).get(
      DEV_SESSION_COOKIE
    )?.value;
    if (devToken) {
      return devToken;
    }
  }

  const { getToken } = await auth();
  return (await getToken()) ?? undefined;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const token = await getSessionToken();

  const headers = new Headers(options.headers);

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  if (
    options.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  try {
    return await fetch(
      `${API_BASE}${path}`,
      {
        ...options,
        headers,
        cache: "no-store",
      }
    );
  } catch (error) {
    console.error(
      `Fiscora API unreachable at ${API_BASE}${path}`,
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          "API unavailable",
      }),
      {
        status: 503,
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  }
}

/** Full auth state including provisioning errors. */
export async function getAuthState(): Promise<AuthState> {
  // DEV: an explicit demo session (set at /dev-login) takes precedence so it
  // overrides any lingering Clerk session, including unprovisioned ones.
  const hasDevSession = isDevAuthEnabled()
    ? Boolean((await cookies()).get(DEV_SESSION_COOKIE)?.value)
    : false;

  const { userId } = await auth();

  if (!userId && !hasDevSession) {
    return { status: "unauthenticated" };
  }

  const res = await apiFetch("/auth/me");

  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    if (data.code === "ACCOUNT_NOT_PROVISIONED") {
      return { status: "not_provisioned" };
    }
  }

  if (!res.ok) {
    return { status: "unauthenticated" };
  }

  const data = await res.json();
  const user = data.user ?? null;

  if (!user) {
    return { status: "unauthenticated" };
  }

  return {
    status: "authenticated",
    isDevSession: hasDevSession,
    user: {
      ...user,
      permissions: resolveUserPermissions(user),
    },
  };
}

export async function getCurrentUser() {
  const state = await getAuthState();

  if (state.status !== "authenticated") {
    return null;
  }

  return state.user;
}
