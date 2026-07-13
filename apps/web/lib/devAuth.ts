/**
 * Development identity override (DEV ONLY).
 *
 * When enabled, demo-role accounts can sign in via /dev-login with one click —
 * no Clerk/OTP — using the legacy session cookie the backend already supports.
 * Everything is double-guarded by NODE_ENV so production behaviour is unchanged:
 * Clerk remains the sole authentication gate in production.
 */
export const DEV_SESSION_COOKIE = "session";

export function isDevAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.FISCORA_DEV_AUTH === "true"
  );
}

/** Demo accounts shown in the /dev-login picker (display only; backend validates). */
export const DEV_DEMO_ACCOUNTS: {
  email: string;
  role: string;
  label: string;
}[] = [
  { email: "admin@fiscora.com", role: "ADMIN", label: "Admin" },
  { email: "cfo@fiscora.com", role: "CFO", label: "CFO" },
  { email: "director@fiscora.com", role: "DIRECTOR", label: "Director" },
  {
    email: "procurement@fiscora.com",
    role: "PROCUREMENT",
    label: "Procurement",
  },
  { email: "manager@fiscora.com", role: "MANAGER", label: "Manager" },
  { email: "finance@fiscora.com", role: "FINANCE", label: "Finance" },
  { email: "auditor@fiscora.com", role: "AUDITOR", label: "Auditor" },
  { email: "employee@fiscora.com", role: "EMPLOYEE", label: "Employee" },
];
