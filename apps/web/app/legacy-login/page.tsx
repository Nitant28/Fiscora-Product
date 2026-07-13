/**
 * Legacy Login Page (rollback path during the Clerk migration).
 * Purpose: Password auth → legacy "session" cookie. Reachable at /legacy-login.
 * Remove once Clerk is fully validated in production (Sprint 18A.18).
 */
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LegacyLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
