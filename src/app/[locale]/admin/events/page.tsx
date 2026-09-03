import { getTranslations } from "next-intl/server";

import { VenueScopeForm } from "@/components/staff-presence/venue-scope-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { Link } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { loadAdminEvents } from "@/core/events/queries";

export const dynamic = "force-dynamic";

interface AdminEventsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
}

export default async function AdminEventsPage({
  params,
  searchParams,
}: AdminEventsPageProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
  const { filter } = await searchParams;
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("eventsAdmin");

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

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </header>

      {venues.length > 1 ? (
        <VenueScopeForm
          venues={venues}
          currentVenueId={current.id}
          label={t("venueSelector")}
          submitLabel={t("useVenue")}
        />
      ) : null}

      {eventsData.moduleState !== "enabled" &&
      eventsData.moduleState !== "trial" ? (
        <p className="text-muted-foreground">
          {eventsData.moduleState === "not_entitled"
            ? t("stateNotEntitled")
            : eventsData.moduleState === "entitled_disabled"
              ? t("stateEntitledDisabled")
              : eventsData.moduleState === "expired"
                ? t("stateExpired")
                : eventsData.moduleState === "restricted"
                  ? t("stateRestricted")
                  : eventsData.moduleState === "suspended"
                    ? t("stateSuspended")
                    : t("unavailable")}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            {canCreate ? (
              <Button asChild>
                <Link href="/admin/events/new">{t("createEvent")}</Link>
              </Button>
            ) : null}

            <div className="flex gap-2 flex-wrap">
              {filters.map((f) => (
                <a
                  key={f}
                  href={`?filter=${f}`}
                  className={`text-sm px-3 py-1 rounded-full border ${
                    (filter ?? "all") === f
                      ? "bg-foreground text-background"
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
            </div>
          </div>

          {eventsData.rows.length === 0 ? (
            <p className="text-muted-foreground">{t("noEvents")}</p>
          ) : (
            <div className="space-y-2">
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
                              : row.state;
                const dateStr = new Date(row.startsAt).toLocaleString(
                  locale === "th" ? "th-TH" : "en-US",
                  {
                    timeZone: eventsData.venueTimezone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  },
                );
                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{title}</p>
                      <p className="text-sm text-muted-foreground">{dateStr}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{stateLabel}</Badge>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/admin/events/${row.id}`}
                          aria-label={`${t("editEvent")}: ${title}`}
                        >
                          {t("editEvent")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Module config link for users with that permission */}
      {canConfigureModule ? (
        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {t("stateEnabled")}: {eventsData.moduleState}
          </p>
        </div>
      ) : null}
    </div>
  );
}
