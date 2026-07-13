/**
 * Edge proxy / middleware (Next.js 16 convention).
 *
 * Clerk is the SOLE authentication gate for the application (Sprint 18A final).
 * Any unauthenticated request to a protected page is redirected to /login before
 * the page renders. No page is ever shown to an unauthenticated user.
 *
 * Public pages: landing, login, signup, clerk-test, vendor self-service onboarding.
 * API routes pass through the edge (the Fastify backend enforces auth on its own
 * via Bearer token); webhooks are explicitly public.
 *
 * clerkMiddleware() also exposes auth()/getToken() to server components and
 * proxy route handlers.
 */
import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isDevAuthEnabled, DEV_SESSION_COOKIE } from "./lib/devAuth";

const isPublicPage = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/signup",
  "/clerk-test(.*)",
  "/legacy-login(.*)",
  "/dev-login(.*)",
]);

function isVendorSelfService(pathname: string): boolean {
  return (
    pathname.startsWith("/vendor-onboarding/") &&
    !pathname.startsWith("/vendor-onboarding/admin")
  );
}

export const proxy = clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const pass = () =>
    NextResponse.next({
      request: { headers: requestHeaders },
    });

  // API + webhooks pass through the edge; the backend enforces auth itself.
  if (pathname.startsWith("/api/")) {
    return pass();
  }

  // Public pages and vendor self-service onboarding.
  if (isPublicPage(request) || isVendorSelfService(pathname)) {
    return pass();
  }

  // Everything else is a protected application page → require a Clerk session.
  const { userId } = await auth();

  // DEV ONLY: a legacy dev session cookie also satisfies the gate. The backend
  // only issues this cookie when FISCORA_DEV_AUTH is on, so it's inert in prod.
  const hasDevSession =
    isDevAuthEnabled() &&
    Boolean(request.cookies.get(DEV_SESSION_COOKIE)?.value);

  if (!userId && !hasDevSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return pass();
});

export const config = {
  // Clerk/Next.js 16 recommended matcher: skip Next internals and all static
  // files (unless referenced via search params), and always run for API routes.
  // A too-loose matcher lets asset 404s reach pages that call auth(), which
  // triggers "can't detect clerkMiddleware()".
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
