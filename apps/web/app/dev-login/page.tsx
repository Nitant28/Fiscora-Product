/**
 * /dev-login — DEV ONLY one-click demo-role sign-in.
 * Returns 404 unless NODE_ENV!=production AND FISCORA_DEV_AUTH=true, so it
 * disappears completely in production. Real users always use /login (Clerk).
 */
import { notFound } from "next/navigation";
import { isDevAuthEnabled, DEV_DEMO_ACCOUNTS } from "../../lib/devAuth";
import DevLoginClient from "./DevLoginClient";

export default function DevLoginPage() {
  if (!isDevAuthEnabled()) {
    notFound();
  }

  return <DevLoginClient accounts={DEV_DEMO_ACCOUNTS} />;
}
