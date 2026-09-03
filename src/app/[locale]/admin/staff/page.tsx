import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/patterns/page-header";
import { StaffAdminPanel } from "@/components/staff-presence/staff-admin-panel";
import { VenueScopeForm } from "@/components/staff-presence/venue-scope-form";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { resolveRequestLocale } from "@/core/i18n/server";
import {
  listAdminVenues,
  loadStaffDirectory,
} from "@/core/staff-presence/queries";
import { actorOwnsConsentedProfile } from "@/core/staff-presence/ownership";

export const dynamic = "force-dynamic";

interface AdminStaffPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminStaffPage({
  params,
}: AdminStaffPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("staffAdmin");

  if (!isActiveAuthenticatedActor(actor)) {
    return <p>{t("unavailable")}</p>;
  }

  const venues = await listAdminVenues(actor);
  const current =
    venues.find((row) => row.id === actor.currentVenueId) ?? venues[0];

  if (current === undefined) {
    return <p>{t("noVenue")}</p>;
  }

  const directory = await loadStaffDirectory(
    actor,
    current.id,
    current.businessId,
  );

  const labels: Record<string, string> = {
    moduleSettings: t("moduleSettings"),
    moduleSettingsHelp: t("moduleSettingsHelp"),
    enabled: t("enabled"),
    publiclyVisible: t("publiclyVisible"),
    displayMode: t("displayMode"),
    showAll: t("showAll"),
    showPresentOnly: t("showPresentOnly"),
    carouselOrder: t("carouselOrder"),
    orderDisplay: t("orderDisplay"),
    orderName: t("orderName"),
    expiryHours: t("expiryHours"),
    autoAdvance: t("autoAdvance"),
    headingEn: t("headingEn"),
    headingTh: t("headingTh"),
    saveSettings: t("saveSettings"),
    addStaff: t("addStaff"),
    privatePublicSplit: t("privatePublicSplit"),
    internalName: t("internalName"),
    internalHint: t("internalHint"),
    publicName: t("publicName"),
    publicTitle: t("publicTitle"),
    bioEn: t("bioEn"),
    bioTh: t("bioTh"),
    displayOrder: t("displayOrder"),
    assignExisting: t("assignExisting"),
    businessStaff: t("businessStaff"),
    confirmBulk: t("confirmBulk"),
    bulkNotPresent: t("bulkNotPresent"),
    confirmRequired: t("confirmRequired"),
    publicOnly: t("publicOnly"),
    publication: t("publication"),
    draft: t("draft"),
    published: t("published"),
    saveProfile: t("saveProfile"),
    grantConsent: t("grantConsent"),
    withdrawConsent: t("withdrawConsent"),
    markPresent: t("markPresent"),
    markNotPresent: t("markNotPresent"),
    confirmDeactivate: t("confirmDeactivate"),
    confirmRestore: t("confirmRestore"),
    deactivate: t("deactivate"),
    restore: t("restore"),
    saved: t("saved"),
    genericError: t("genericError"),
    unauthenticated: t("unauthenticated"),
    forbidden: t("forbidden"),
    invalid_payload: t("invalidPayload"),
    not_found: t("notFound"),
    conflict: t("conflict"),
    inactive: t("inactive"),
    unavailable: t("unavailable"),
    state_not_entitled: t("stateNotEntitled"),
    state_entitled_disabled: t("stateEntitledDisabled"),
    state_enabled: t("stateEnabled"),
    state_trial: t("stateTrial"),
    state_expired: t("stateExpired"),
    state_restricted: t("stateRestricted"),
    state_suspended: t("stateSuspended"),
    consentPending: t("consentPending"),
    consentGranted: t("consentGranted"),
    consentWithdrawn: t("consentWithdrawn"),
    presencePresent: t("presencePresent"),
    presenceNotPresent: t("presenceNotPresent"),
    staffActive: t("staffActive"),
    staffDeactivated: t("staffDeactivated"),
    moreActions: t("moreActions"),
    details: t("details"),
  };

  const canSeeModule =
    can(actor, "manage_public_staff_profiles", {
      type: "venue",
      venueId: current.id,
      businessId: current.businessId,
    }) ||
    can(actor, "toggle_staff_presence", {
      type: "venue",
      venueId: current.id,
      businessId: current.businessId,
    }) ||
    can(actor, "view_private_staff_data", {
      type: "venue",
      venueId: current.id,
      businessId: current.businessId,
    }) ||
    can(actor, "manage_own_public_profile", {
      type: "self",
      venueId: current.id,
      userId: actor.userId,
    }) ||
    can(actor, "manage_own_consent", {
      type: "self",
      venueId: current.id,
      userId: actor.userId,
    }) ||
    can(actor, "toggle_own_presence", {
      type: "self",
      venueId: current.id,
      userId: actor.userId,
    }) ||
    directory.rows.some((row) => actorOwnsConsentedProfile(actor.userId, row));

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("intro")} />
      {venues.length > 1 ? (
        <VenueScopeForm
          venues={venues}
          currentVenueId={current.id}
          label={t("venueSelector")}
          submitLabel={t("useVenue")}
        />
      ) : null}
      {!canSeeModule ? (
        <p>{t("noAccess")}</p>
      ) : (
        <StaffAdminPanel
          capabilities={{
            userId: actor.userId,
            canManageProfiles: can(actor, "manage_public_staff_profiles", {
              type: "venue",
              venueId: current.id,
              businessId: current.businessId,
            }),
            canToggleAnyPresence: can(actor, "toggle_staff_presence", {
              type: "venue",
              venueId: current.id,
              businessId: current.businessId,
            }),
            canConfigureModule: can(actor, "manage_venue_module_visibility", {
              type: "venue",
              venueId: current.id,
              businessId: current.businessId,
            }),
            canEditOwnProfile: can(actor, "manage_own_public_profile", {
              type: "self",
              venueId: current.id,
              userId: actor.userId,
            }),
            canManageOwnConsent: can(actor, "manage_own_consent", {
              type: "self",
              venueId: current.id,
              userId: actor.userId,
            }),
          }}
          venueId={current.id}
          directory={directory}
          labels={labels}
        />
      )}
    </div>
  );
}
