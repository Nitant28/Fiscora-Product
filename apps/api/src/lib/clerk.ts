/**
 * Clerk backend integration — the ONLY file that talks to Clerk.
 *
 * Responsibility: IDENTITY VERIFICATION ONLY.
 *   - verifyClerkToken(): validate a Clerk session JWT and return its claims (sub = clerkId).
 *   - getClerkUser(): read a Clerk user's profile (name, email, image).
 *
 * It does NOT know about Fiscora tenants, roles, permissions, or procurement.
 * Authorization remains owned by the Fiscora database + permission engine.
 *
 * This isolation means Clerk can later be swapped for Azure AD / Okta / any IdP
 * by replacing only this file.
 */
import {
  createClerkClient,
  verifyToken,
  type ClerkClient,
} from "@clerk/backend";

// Read env lazily: the API loads .env via Prisma at client construction, so
// reading at call time (not import time) avoids import-order races.
function getSecretKey(): string | undefined {
  return process.env.CLERK_SECRET_KEY;
}

let cachedClient: ClerkClient | null = null;

/** Lazily-created singleton Clerk client (server-side, secret key). */
function getClerkClient(): ClerkClient {
  if (!cachedClient) {
    cachedClient = createClerkClient({
      secretKey: getSecretKey() ?? "",
    });
  }
  return cachedClient;
}

export function isClerkConfigured(): boolean {
  return Boolean(getSecretKey());
}

export type ClerkIdentity = {
  clerkId: string;
  sessionId?: string;
  // Token issued-at (epoch seconds). Used to enforce session invalidation.
  issuedAt?: number;
};

export type ClerkProfile = {
  clerkId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  imageUrl: string | null;
};

/**
 * Verifies a Clerk-issued session JWT (networkless, via Clerk JWKS).
 * Returns the identity (clerkId) on success, or null if invalid/misconfigured.
 * Never throws to the caller — callers branch on null.
 */
export async function verifyClerkToken(
  token: string
): Promise<ClerkIdentity | null> {
  const secretKey = getSecretKey();
  if (!secretKey) {
    return null;
  }

  try {
    const claims = await verifyToken(token, {
      secretKey,
    });

    if (!claims?.sub) {
      return null;
    }

    return {
      clerkId: claims.sub,
      sessionId:
        typeof claims.sid === "string"
          ? claims.sid
          : undefined,
      issuedAt:
        typeof claims.iat === "number"
          ? claims.iat
          : undefined,
    };
  } catch (error) {
    console.warn(
      "[clerk] Token verification failed:",
      error instanceof Error
        ? error.message
        : error
    );
    return null;
  }
}

/**
 * Reads a Clerk user's profile by clerkId. Identity data only.
 * Returns null on failure (caller decides how to handle).
 */
export async function getClerkUser(
  clerkId: string
): Promise<ClerkProfile | null> {
  if (!getSecretKey()) {
    return null;
  }

  try {
    const user = await getClerkClient().users.getUser(
      clerkId
    );

    const primaryEmail =
      user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;

    const name =
      [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ") || null;

    return {
      clerkId: user.id,
      email: primaryEmail,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      name,
      imageUrl: user.imageUrl ?? null,
    };
  } catch (error) {
    console.warn(
      "[clerk] getClerkUser failed:",
      error instanceof Error
        ? error.message
        : error
    );
    return null;
  }
}

export type EnsureClerkUserResult =
  | { ok: true; clerkId: string; created: boolean }
  | { ok: false; reason: string };

/**
 * DEV/TEST ONLY: ensures a Clerk user exists for an email/password, creating it
 * if missing. Returns the clerkId so the caller can link it to a Fiscora user.
 *
 * Production onboarding uses createClerkInvitation (email-based) instead — this
 * helper exists so a demo environment can provision all role accounts in one go.
 */
export async function ensureClerkUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<EnsureClerkUserResult> {
  if (!getSecretKey()) {
    return { ok: false, reason: "CLERK_NOT_CONFIGURED" };
  }

  const client = getClerkClient();

  try {
    // Reuse an existing Clerk identity for this email if present.
    const list = await client.users.getUserList({
      emailAddress: [input.email],
    });
    const existing = Array.isArray(list)
      ? list
      : (list as { data?: { id: string }[] }).data ?? [];

    if (existing.length > 0 && existing[0]?.id) {
      return {
        ok: true,
        clerkId: existing[0].id,
        created: false,
      };
    }

    const user = await client.users.createUser({
      emailAddress: [input.email],
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      skipPasswordChecks: true,
    });

    return { ok: true, clerkId: user.id, created: true };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "CLERK_CREATE_USER_FAILED",
    };
  }
}

export type ClerkInvitationResult =
  | {
      ok: true;
      clerkInvitationId: string;
    }
  | {
      ok: false;
      reason: string;
    };

/**
 * Sends a Clerk invitation email. The Fiscora User row must already exist —
 * Clerk only delivers the "accept" email and provisions the identity.
 *
 * Gracefully degrades: if Clerk is unconfigured or the call fails, returns
 * { ok:false }. The caller keeps the DB invitation as PENDING and can resend.
 */
export async function createClerkInvitation(
  email: string,
  redirectUrl?: string
): Promise<ClerkInvitationResult> {
  if (!getSecretKey()) {
    return { ok: false, reason: "CLERK_NOT_CONFIGURED" };
  }

  try {
    const invitation =
      await getClerkClient().invitations.createInvitation({
        emailAddress: email,
        redirectUrl,
        // Don't fail if the email already has a Clerk account/invite.
        ignoreExisting: true,
        notify: true,
      });

    return {
      ok: true,
      clerkInvitationId: invitation.id,
    };
  } catch (error) {
    console.warn(
      "[clerk] createClerkInvitation failed:",
      error instanceof Error
        ? error.message
        : error
    );
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "CLERK_INVITE_FAILED",
    };
  }
}

/**
 * Revokes a pending Clerk invitation by its Clerk invitation id.
 * Returns false if unconfigured or the call fails (already accepted/revoked).
 */
export async function revokeClerkInvitation(
  clerkInvitationId: string
): Promise<boolean> {
  if (!getSecretKey()) {
    return false;
  }

  try {
    await getClerkClient().invitations.revokeInvitation(
      clerkInvitationId
    );
    return true;
  } catch (error) {
    console.warn(
      "[clerk] revokeClerkInvitation failed:",
      error instanceof Error
        ? error.message
        : error
    );
    return false;
  }
}
