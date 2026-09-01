import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveRequestActor } from "@/core/actors/resolve";
import { canOnboardTenants } from "@/core/authz/can";
import {
  parseSafeApplicationPath,
  signInNavigationHref,
} from "@/core/auth/redirects";
import { Link, redirect } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";
import { loadPlatformVenueOverview } from "@/core/onboarding/queries";

const VENUE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OverviewPageProps {
  params: Promise<{ locale: string; venueId: string }>;
}

export default async function PlatformVenueOverviewPage({
  params,
}: OverviewPageProps): Promise<React.ReactElement> {
  const { venueId } = await params;
  const locale = await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "platform" });
  const t = await getTranslations("platformOverview");

  if (actor.kind !== "authenticated") {
    redirect({
      href: signInNavigationHref(
        parseSafeApplicationPath(`/platform/venues/${venueId}`),
      ),
      locale,
    });
  }

  if (!canOnboardTenants(actor) || !VENUE_ID.test(venueId)) {
    redirect({ href: "/unauthorized", locale });
  }

  const overview = await loadPlatformVenueOverview(venueId);
  if (overview === null) {
    notFound();
  }

  const classificationKey =
    overview.classification === "nightlife_18_plus"
      ? "adultNightlife"
      : "general";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href="/platform" className="underline underline-offset-4">
            {t("back")}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{overview.venueName}</CardTitle>
          <CardDescription>{overview.businessName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            {t("slug")}: {overview.slug}
          </p>
          <p className="flex flex-wrap items-center gap-2">
            {t("publication")}:
            <Badge variant="outline">{overview.publicationState}</Badge>
          </p>
          {overview.publicationState !== "published" && (
            <p>{t("unpublished")}</p>
          )}
          <p>
            {t("classification")}: {t(classificationKey)}
          </p>
          <p>
            {t("timezone")}: {overview.timezone}
          </p>
          <p>
            {t("subscription")}: {overview.subscriptionState ?? t("unknown")}
          </p>
          <p>
            {t("trialEnds")}: {overview.trialEndsAt ?? t("unknown")}
          </p>
          <p>
            {t("modules")}: {overview.entitledModules.join(", ") || t("none")}
          </p>
          <p>
            {t("denied")}: {overview.deniedModules.join(", ") || t("none")}
          </p>
          <p>
            {t("storage")}: {overview.usedBytes ?? 0} /{" "}
            {overview.quotaBytes ?? t("unknown")}
          </p>
          <p>
            {t("invitation")}: {overview.invitationState ?? t("unknown")}
            {overview.invitationEmail !== null
              ? ` (${overview.invitationEmail})`
              : ""}
          </p>
          <p>{t("tokenAbsent")}</p>
          {overview.branding !== null && (
            <p>
              {t("branding")}: {overview.branding.themeKey} ·{" "}
              {overview.branding.primaryColor} /{" "}
              {overview.branding.backgroundColor}
            </p>
          )}
          {overview.auditSummaries.length > 0 && (
            <div>
              <p className="font-medium">{t("audit")}</p>
              <ul className="list-disc ps-5">
                {overview.auditSummaries.map((summary) => (
                  <li key={summary}>{summary}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
