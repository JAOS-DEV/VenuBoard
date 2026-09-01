import { getTranslations } from "next-intl/server";

import { OnboardingWizard } from "@/components/platform/onboarding-wizard";
import { resolveRequestActor } from "@/core/actors/resolve";
import { canOnboardTenants } from "@/core/authz/can";
import {
  parseSafeApplicationPath,
  signInNavigationHref,
} from "@/core/auth/redirects";
import { redirect } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";
import { loadOnboardingCatalogue } from "@/core/onboarding/catalogue";

interface OnboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PlatformOnboardPage({
  params,
}: OnboardPageProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "platform" });
  const t = await getTranslations("onboarding");

  if (actor.kind !== "authenticated") {
    redirect({
      href: signInNavigationHref(parseSafeApplicationPath("/platform/onboard")),
      locale,
    });
  }

  if (!canOnboardTenants(actor)) {
    redirect({ href: "/unauthorized", locale });
  }

  const catalogue = await loadOnboardingCatalogue();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <OnboardingWizard catalogue={catalogue} />
    </div>
  );
}
