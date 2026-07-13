import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/api";
import { hasPermission, PERMISSION_KEYS } from "../../lib/permissions";
import OnboardingWizard from "../../components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, PERMISSION_KEYS.USER_MANAGE)) {
    redirect("/dashboard");
  }

  return <OnboardingWizard />;
}
