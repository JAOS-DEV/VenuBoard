import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { EventAdminPanel } from "@/components/events/event-admin-panel";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { loadAdminEvents } from "@/core/events/queries";

export const dynamic = "force-dynamic";

interface NewEventPageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewEventPage({
  params,
}: NewEventPageProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("eventsAdmin");

  if (!isActiveAuthenticatedActor(actor)) {
    redirect(`/${locale}/sign-in`);
  }

  const venues = await listAdminVenues(actor);
  const current =
    venues.find((row) => row.id === actor.currentVenueId) ?? venues[0];

  if (current === undefined) {
    redirect(`/${locale}/admin/events`);
  }

  const scope = {
    type: "venue" as const,
    venueId: current.id,
    businessId: current.businessId,
  };

  const canCreate = can(actor, "create_content", scope);
  if (!canCreate) {
    redirect(`/${locale}/admin/events`);
  }

  const eventsData = await loadAdminEvents(
    actor,
    current.id,
    current.businessId,
  );

  const canCopyToVenues = canCreate && eventsData.copyDestinations.length > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("createEvent")}
        </h1>
      </header>
      <EventAdminPanel
        venueId={current.id}
        venueTimezone={eventsData.venueTimezone}
        locale={locale}
        moduleState={eventsData.moduleState}
        approvalRequired={eventsData.approvalRequired}
        capabilities={{
          canCreate,
          canEdit: canCreate,
          canSubmit: can(actor, "submit_content_for_approval", scope),
          canApprove: can(actor, "approve_content", scope),
          canPublish: can(actor, "publish_content", scope),
          canManageLifecycle: can(actor, "manage_events", scope),
          canConfigureModule: can(
            actor,
            "manage_venue_module_visibility",
            scope,
          ),
          canCopyToVenues,
        }}
        availableCopyDestinations={eventsData.copyDestinations}
        event={null}
      />
    </div>
  );
}
