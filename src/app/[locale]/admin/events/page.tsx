import { getTranslations } from "next-intl/server";

import { FilterBar } from "@/components/patterns/filter-bar";
import { ModuleUnavailableState } from "@/components/patterns/module-unavailable-state";
import { PageHeader } from "@/components/patterns/page-header";
import { StatusBadge } from "@/components/patterns/status-badge";
import { VenueScopeForm } from "@/components/staff-presence/venue-scope-form";
import { Button } from "@/components/ui/button";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { Link } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { loadAdminEvents } from "@/core/events/queries";
import { moduleAvailabilityCopyKey } from "@/core/ui/status";
import type { BadgeProps } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface AdminEventsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
}

function eventBadgeVariant(
  state: string,
  approvalStatus: string,
): NonNullable<BadgeProps["variant"]> {
  if (state === "draft" && approvalStatus === "pending") {
    return "pending";
  }
  if (state === "draft") {
    return "draft";
  }
  if (state === "published") {
    return "published";
  }
  if (state === "scheduled") {
    return "scheduled";
  }
  if (state === "cancelled") {
    return "cancelled";
  }
  if (state === "archived") {
    return "archived";
  }
  return "secondary";
}

export default async function AdminEventsPage({
  params,
  searchParams,
}: AdminEventsPageProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
  const { filter } = await searchParams;
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("eventsAdmin");
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

  const scope = {
    type: "venue" as const,
    venueId: current.id,
    businessId: current.businessId,
  };

  const canCreate = can(actor, "create_content", scope);
  const canEdit = can(actor, "create_content", scope);
  const canSubmit = can(actor, "submit_content_for_approval", scope);
  const canApprove = can(actor, "approve_content", scope);
  const canPublish = can(actor, "publish_content", scope);
  const canManageLifecycle = can(actor, "manage_events", scope);
  const canConfigureModule = can(
    actor,
    "manage_venue_module_visibility",
    scope,
  );

  const hasAnyAccess =
    canCreate ||
    canEdit ||
    canSubmit ||
    canApprove ||
    canPublish ||
    canManageLifecycle ||
    canConfigureModule;

  if (!hasAnyAccess) {
    return <p>{t("noAccess")}</p>;
  }

  const eventsData = await loadAdminEvents(
    actor,
    current.id,
    current.businessId,
    filter,
  );

  const filters = [
    "all",
    "draft",
    "published",
    "scheduled",
    "cancelled",
    "archived",
  ];

  const moduleOk =
    eventsData.moduleState === "enabled" || eventsData.moduleState === "trial";

  const availabilityKey = moduleAvailabilityCopyKey(eventsData.moduleState);
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
              : t("stateEnabled");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          canCreate && moduleOk ? (
            <Button asChild>
              <Link href="/admin/events/new">{t("createEvent")}</Link>
            </Button>
          ) : null
        }
      />

      {venues.length > 1 ? (
        <VenueScopeForm
          venues={venues}
          currentVenueId={current.id}
          label={t("venueSelector")}
          submitLabel={t("useVenue")}
        />
      ) : null}

      {!moduleOk ? (
        <ModuleUnavailableState title={availabilityLabel} />
      ) : (
        <>
          <FilterBar label={t("filterAll")}>
            {filters.map((f) => (
              <a
                key={f}
                href={`?filter=${f}`}
                className={`inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-sm ${
                  (filter ?? "all") === f
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-accent"
                }`}
              >
                {f === "all"
                  ? t("filterAll")
                  : f === "draft"
                    ? t("filterDraft")
                    : f === "published"
                      ? t("filterPublished")
                      : f === "scheduled"
                        ? t("filterScheduled")
                        : f === "cancelled"
                          ? t("filterCancelled")
                          : t("filterArchived")}
              </a>
            ))}
          </FilterBar>

          {eventsData.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
          ) : (
            <ul className="space-y-2">
              {eventsData.rows.map((row) => {
                const title = row.titleEn ?? row.titleTh ?? "(untitled)";
                const stateLabel =
                  row.state === "draft" && row.approvalStatus === "pending"
                    ? t("pendingApproval")
                    : row.state === "draft"
                      ? t("draft")
                      : row.state === "published"
                        ? t("published")
                        : row.state === "scheduled"
                          ? t("scheduled")
                          : row.state === "cancelled"
                            ? t("cancelled")
                            : row.state === "archived"
                              ? t("archived")
                              : tStatus("draft");
                const dateStr = new Date(row.startsAt).toLocaleString(
                  locale === "th" ? "th-TH" : "en-US",
                  {
                    timeZone: eventsData.venueTimezone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  },
                );
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">{title}</p>
                      <p className="text-sm text-muted-foreground">{dateStr}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={stateLabel}
                        variant={eventBadgeVariant(
                          row.state,
                          row.approvalStatus,
                        )}
                      />
                      <Button asChild variant="outline">
                        <Link
                          href={`/admin/events/${row.id}`}
                          aria-label={`${t("editEvent")}: ${title}`}
                        >
                          {t("editEvent")}
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {canConfigureModule ? (
        <p className="text-sm text-muted-foreground">{availabilityLabel}</p>
      ) : null}
    </div>
  );
}
