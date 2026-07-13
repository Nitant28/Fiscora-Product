/**
 * Signup Page — powered by Clerk (Sprint 18A activation).
 * Catch-all segment lets Clerk handle path-based sub-routes (verify-email-address).
 *
 * Production note: open self-sign-up should be disabled for B2B. Employees
 * join via admin invitations (Sprint 18B); only a trial company's first admin
 * should create an account here. Lock this down in the Clerk dashboard before launch.
 */
import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-8">
      <SignUp />
      <a
        href="/login"
        className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
      >
        Already have an account? Sign in
      </a>
    </main>
  );
}
