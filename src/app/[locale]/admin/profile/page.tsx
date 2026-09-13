import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/patterns/page-header";
import { VenueScopeForm } from "@/components/staff-presence/venue-scope-form";
import { VenueProfileEditor } from "@/components/venue-profile/venue-profile-editor";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { loadAdminVenueProfile } from "@/core/venue-profile/queries";

export const dynamic = "force-dynamic";

interface AdminProfilePageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminProfilePage({
  params,
}: AdminProfilePageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("venueProfileAdmin");

  if (!isActiveAuthenticatedActor(actor)) {
    return <p>{t("unavailable")}</p>;
  }

  const venues = await listAdminVenues(actor);
  const current =
    venues.find((row) => row.id === actor.currentVenueId) ?? venues[0];
  if (current === undefined) {
    return <p>{t("noVenue")}</p>;
  }

  const scope = {
    type: "venue" as const,
    venueId: current.id,
    businessId: current.businessId,
  };
  const canManageVenue = can(actor, "manage_venue", scope);
  const canManageBranding = can(actor, "manage_branding", scope);
  if (!canManageVenue && !canManageBranding) {
    return <p>{t("noAccess")}</p>;
  }

  const profile = await loadAdminVenueProfile(actor, current.id);
  if (profile === null) {
    return <p>{t("unavailable")}</p>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("intro")} />
      {venues.length > 1 ? (
        <VenueScopeForm
          venues={venues}
          currentVenueId={actor.currentVenueId}
          label={t("venueSelector")}
          submitLabel={t("useVenue")}
        />
      ) : null}
      <VenueProfileEditor
        key={profile.venueId}
        profile={profile}
        canManageVenue={canManageVenue}
        canManageBranding={canManageBranding}
      />
    </div>
  );
}
