/**
 * Account Not Provisioned — shown when Clerk auth succeeds but no Fiscora user exists.
 * Authentication (Clerk) is separate from provisioning (Fiscora). This page never
 * downgrades the user to a limited dashboard; it explains the state and offers a
 * real "Request Access" workflow routed to administrators.
 */
import { currentUser } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import RequestAccessForm from "./RequestAccessForm";
import { isDevAuthEnabled } from "../../lib/devAuth";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "admin@fiscora.com";
const WORKSPACE_NAME =
  process.env.NEXT_PUBLIC_WORKSPACE_NAME ?? "Fiscora";
const ORG_NAME =
  process.env.NEXT_PUBLIC_ORG_NAME ?? "Fiscora Technologies";

export default async function AccountNotProvisionedPage() {
  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    null;
  const name =
    [clerkUser?.firstName, clerkUser?.lastName]
      .filter(Boolean)
      .join(" ") || null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-muted-soft px-8 py-5 text-center">
          <p className="text-2xl font-bold tracking-tight text-foreground">
            Fiscora
          </p>
        </div>

        <div className="px-8 py-9 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.6}
              stroke="currentColor"
              className="h-7 w-7 text-warning"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-semibold text-foreground">
            Your account isn&apos;t set up yet
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-warning-fg">
            Error USR_001 · Identity not provisioned
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            You signed in successfully, but this identity
            hasn&apos;t been linked to a Fiscora workspace.
            Request access below and an administrator will
            review it.
          </p>

          <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">
            {email && (
              <div className="rounded-lg border border-border bg-muted-soft px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Signed in as
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">
                  {name ? `${name} · ` : ""}
                  {email}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Workspace
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">
                  {WORKSPACE_NAME}
                </p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Organization
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">
                  {ORG_NAME}
                </p>
              </div>
            </div>
          </div>

          <RequestAccessForm />

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs text-muted">
              Need access faster?{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Fiscora%20access%20request&body=Please%20provision%20my%20account%20(${encodeURIComponent(
                  email ?? ""
                )}).`}
                className="font-medium text-primary hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
            <div className="mt-4 flex justify-center">
              <SignOutButton redirectUrl="/login">
                <button className="rounded-lg border border-border bg-surface px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted-soft">
                  Sign out
                </button>
              </SignOutButton>
            </div>

            {isDevAuthEnabled() && (
              <div className="mt-4 border-t border-dashed border-border pt-4">
                <p className="text-[11px] uppercase tracking-wide text-muted">
                  Development
                </p>
                <a
                  href="/dev-login"
                  className="mt-1 inline-block text-sm font-medium text-amber-700 hover:underline"
                >
                  Sign in as a demo user →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
