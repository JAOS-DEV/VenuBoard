import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { EventAdminPanel } from "@/components/events/event-admin-panel";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { loadAdminEvents, loadAdminEventDetail } from "@/core/events/queries";

export const dynamic = "force-dynamic";

interface EditEventPageProps {
  params: Promise<{ locale: string; eventId: string }>;
}

export default async function EditEventPage({
  params,
}: EditEventPageProps): Promise<React.ReactElement> {
  const awaitedParams = await params;
  const locale = await resolveRequestLocale(
    Promise.resolve({ locale: awaitedParams.locale }),
  );
  const eventId = awaitedParams.eventId;
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
  const canApprove = can(actor, "approve_content", scope);
  const canPublish = can(actor, "publish_content", scope);
  const canManageLifecycle = can(actor, "manage_events", scope);

  const hasAnyAccess =
    canCreate || canApprove || canPublish || canManageLifecycle;

  if (!hasAnyAccess) {
    redirect(`/${locale}/admin/events`);
  }

  const [eventsData, eventDetail] = await Promise.all([
    loadAdminEvents(actor, current.id, current.businessId),
    loadAdminEventDetail(current.id, eventId),
  ]);

  if (eventDetail === null) {
    redirect(`/${locale}/admin/events`);
  }

  const canCopyToVenues = canCreate && eventsData.copyDestinations.length > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("editEvent")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {eventDetail.titleEn ?? eventDetail.titleTh ?? ""}
        </p>
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
          canApprove,
          canPublish,
          canManageLifecycle,
          canConfigureModule: can(
            actor,
            "manage_venue_module_visibility",
            scope,
          ),
          canCopyToVenues,
        }}
        availableCopyDestinations={eventsData.copyDestinations}
        event={eventDetail}
      />
    </div>
  );
}
