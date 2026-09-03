import { getTranslations } from "next-intl/server";

import { AtmosphereAdminPanel } from "@/components/atmosphere/atmosphere-admin-panel";
import { ModuleUnavailableState } from "@/components/patterns/module-unavailable-state";
import { PageHeader } from "@/components/patterns/page-header";
import { VenueScopeForm } from "@/components/staff-presence/venue-scope-form";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { atmosphereFrontOfHouseProvenConditions } from "@/core/authz/scope";
import { loadAdminAtmosphere } from "@/core/atmosphere/queries";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { moduleAvailabilityCopyKey } from "@/core/ui/status";

export const dynamic = "force-dynamic";

interface AdminAtmospherePageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminAtmospherePage({
  params,
}: AdminAtmospherePageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("atmosphereAdmin");
  const tStatus = await getTranslations("status");

  if (!isActiveAuthenticatedActor(actor)) {
    return <p>{t("unavailable")}</p>;
  }

  const venues = await listAdminVenues(actor);
  const current =
    venues.find((row) => row.id === actor.currentVenueId) ?? venues[0];

  if (current === undefined) {
    return <p>{t("noVenue")}</p>;
  }

  const data = await loadAdminAtmosphere(current.id);
  const role =
    actor.venueMemberships.find((row) => row.venueId === current.id)?.role ??
    null;
  const scope = {
    type: "venue" as const,
    venueId: current.id,
    businessId: current.businessId,
  };
  const proven = atmosphereFrontOfHouseProvenConditions(
    role,
    data.settings.frontOfHouseMayUpdate,
  );
  const canWrite = can(actor, "manage_atmosphere", scope, {
    provenConditions: proven,
  });
  const canConfigure = can(actor, "manage_venue_module_visibility", scope);

  if (!canWrite && !canConfigure) {
    return <p>{t("noAccess")}</p>;
  }

  const moduleOk =
    data.moduleState === "enabled" || data.moduleState === "trial";
  const writesBlocked =
    data.moduleState === "restricted" || data.moduleState === "suspended";
  const availabilityKey = moduleAvailabilityCopyKey(data.moduleState);
  const availabilityLabel =
    availabilityKey === "notEntitled"
      ? t("stateNotEntitled")
      : availabilityKey === "moduleDisabled"
        ? t("stateEntitledDisabled")
        : availabilityKey === "trialExpired"
          ? t("stateExpired")
          : availabilityKey === "temporarilyUnavailable"
            ? t("stateRestricted")
            : availabilityKey === "trial"
              ? t("stateTrial")
              : tStatus("enabled");

  const labels: Record<string, string> = {
    currentTitle: t("currentTitle"),
    promotionalHelp: t("promotionalHelp"),
    remainingPrefix: t("remainingPrefix"),
    remainingSuffix: t("remainingSuffix"),
    expiry: t("expiry"),
    expiry30: t("expiry30"),
    expiry60: t("expiry60"),
    expiry90: t("expiry90"),
    expiry120: t("expiry120"),
    expiry180: t("expiry180"),
    expiry240: t("expiry240"),
    expiry360: t("expiry360"),
    calm: t("calm"),
    social: t("social"),
    lively: t("lively"),
    highEnergy: t("highEnergy"),
    none: t("none"),
    clear: t("clear"),
    clearConfirmTitle: t("clearConfirmTitle"),
    clearConfirmBody: t("clearConfirmBody"),
    clearConfirm: t("clearConfirm"),
    cancel: t("cancel"),
    readOnly: t("readOnly"),
    saved: t("saved"),
    unauthenticated: t("unauthenticated"),
    forbidden: t("forbidden"),
    invalid_payload: t("invalidPayload"),
    not_found: t("notFound"),
    unavailable: t("unavailable"),
    moduleSettings: t("moduleSettings"),
    moduleSettingsHelp: t("moduleSettingsHelp"),
    enabled: t("enabled"),
    publiclyVisible: t("publiclyVisible"),
    frontOfHouse: t("frontOfHouse"),
    defaultExpiry: t("defaultExpiry"),
    presentation: t("presentation"),
    presentationCard: t("presentationCard"),
    presentationCompact: t("presentationCompact"),
    presentationBadge: t("presentationBadge"),
    headingEn: t("headingEn"),
    headingTh: t("headingTh"),
    saveSettings: t("saveSettings"),
    historyTitle: t("historyTitle"),
    historyHelp: t("historyHelp"),
    historySet: t("historySet"),
    historyReplace: t("historyReplace"),
    historyClear: t("historyClear"),
  };

  return (
    <div
      className="space-y-5"
      data-testid="atmosphere-admin"
      data-venue-id={current.id}
    >
      <PageHeader title={t("title")} description={t("intro")} />
      {venues.length > 1 ? (
        <VenueScopeForm
          venues={venues}
          currentVenueId={current.id}
          label={t("venueSelector")}
          submitLabel={t("useVenue")}
        />
      ) : null}
      {!moduleOk && !writesBlocked ? (
        <ModuleUnavailableState title={availabilityLabel} />
      ) : null}
      {moduleOk || writesBlocked || data.moduleState === "entitled_disabled" ? (
        <AtmosphereAdminPanel
          venueId={current.id}
          data={data}
          canWrite={canWrite}
          canConfigure={canConfigure}
          writesBlocked={writesBlocked}
          labels={labels}
        />
      ) : null}
    </div>
  );
}
