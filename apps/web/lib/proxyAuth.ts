import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { isDevAuthEnabled, DEV_SESSION_COOKIE } from "./devAuth";

export const API_BASE =
  process.env.FISCORA_API_URL ??
  "http://127.0.0.1:4000";

/**
 * Forwards the bearer token to the backend.
 * Production: Clerk session JWT only. Development (FISCORA_DEV_AUTH): falls back
 * to the legacy dev session cookie issued by /dev-login.
 */
export async function getProxyAuthHeaders(
  extra: Record<string, string> = {}
) {
  const { getToken } = await auth();
  let token = await getToken();

  if (!token && isDevAuthEnabled()) {
    token =
      (await cookies()).get(DEV_SESSION_COOKIE)?.value ??
      null;
  }

  const headers: Record<string, string> = {
    ...extra,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}
