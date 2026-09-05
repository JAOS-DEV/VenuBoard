import { Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FeedSettingsForm } from "@/components/feed/feed-settings-form";
import { FilterBar } from "@/components/patterns/filter-bar";
import { ModuleUnavailableState } from "@/components/patterns/module-unavailable-state";
import { PageHeader } from "@/components/patterns/page-header";
import { ResponsiveFilterControls } from "@/components/patterns/responsive-filter-controls";
import { StatusBadge } from "@/components/patterns/status-badge";
import { VenueScopeForm } from "@/components/staff-presence/venue-scope-form";
import { Button } from "@/components/ui/button";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { Link } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { loadAdminFeed } from "@/core/feed/queries";
import { feedStateCopyKey, feedStateBadgeVariant } from "@/core/feed/labels";
import { publicVenueUpdatesPath } from "@/core/feed/public-path";
import { moduleAvailabilityCopyKey } from "@/core/ui/status";

export const dynamic = "force-dynamic";

interface AdminFeedPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string; type?: string }>;
}

export default async function AdminFeedPage({
  params,
  searchParams,
}: AdminFeedPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const { filter, type } = await searchParams;
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("feedAdmin");
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
  const canSubmit = can(actor, "submit_content_for_approval", scope);
  const canApprove = can(actor, "approve_content", scope);
  const canPublish = can(actor, "publish_content", scope);
  const canConfigure = can(actor, "manage_venue_module_visibility", scope);
  const canOpenPost = canCreate || canSubmit || canApprove || canPublish;
  const hasAnyAccess = canOpenPost || canConfigure;

  if (!hasAnyAccess) {
    return <p>{t("noAccess")}</p>;
  }

  const data = await loadAdminFeed(
    actor,
    current.id,
    current.businessId,
    filter,
    type,
  );

  const moduleOk =
    data.moduleState === "enabled" || data.moduleState === "trial";
  const writesBlocked =
    data.moduleState === "restricted" || data.moduleState === "suspended";
  const availabilityKey = moduleAvailabilityCopyKey(data.moduleState);
  const availabilityLabel =
    availabilityKey === "notEntitled"
      ? t("stateNotEntitled")
      : availabilityKey === "moduleDisabled"
        ? t("stateDisabled")
        : availabilityKey === "trialExpired"
          ? t("stateExpired")
          : availabilityKey === "temporarilyUnavailable"
            ? t("stateUnavailable")
            : availabilityKey === "trial"
              ? t("stateTrial")
              : tStatus("enabled");

  const stateHref = (nextFilter: string): string => {
    const params = new URLSearchParams();
    if (nextFilter !== "all") {
      params.set("filter", nextFilter);
    }
    if (type) {
      params.set("type", type);
    }
    const query = params.toString();
    return query.length > 0 ? `/admin/feed?${query}` : "/admin/feed";
  };

  const typeHref = (nextType: string): string => {
    const params = new URLSearchParams();
    if (filter && filter !== "all") {
      params.set("filter", filter);
    }
    if (nextType !== "all") {
      params.set("type", nextType);
    }
    const query = params.toString();
    return query.length > 0 ? `/admin/feed?${query}` : "/admin/feed";
  };

  const statusValue =
    filter === "draft" ||
    filter === "pending_approval" ||
    filter === "scheduled" ||
    filter === "published" ||
    filter === "archived"
      ? filter
      : "all";
  const typeValue =
    type === "update" || type === "announcement" || type === "notice"
      ? type
      : "all";
  const publicUpdatesHref = publicVenueUpdatesPath(current.slug);

  return (
    <div
      className="space-y-5"
      data-testid="feed-admin"
      data-venue-id={current.id}
    >
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <>
            {publicUpdatesHref !== null ? (
              <Button
                asChild
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
              >
                <Link href={publicUpdatesHref}>{t("viewPublic")}</Link>
              </Button>
            ) : null}
            {canCreate && moduleOk ? (
              <Button asChild className="min-h-11 w-full sm:w-auto">
                <Link href="/admin/feed/new">{t("create")}</Link>
              </Button>
            ) : null}
          </>
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
        <ModuleUnavailableState
          title={availabilityLabel}
          description={
            data.moduleState === "not_entitled"
              ? t("stateNotEntitledHelp")
              : data.moduleState === "entitled_disabled"
                ? t("stateDisabledHelp")
                : writesBlocked
                  ? t("readOnly")
                  : t("stateUnavailable")
          }
        />
      ) : (
        <>
          <ResponsiveFilterControls
            fields={[
              {
                id: "feed-status-filter",
                label: t("filterStatus"),
                value: statusValue,
                options: [
                  {
                    value: "all",
                    label: t("filterAll"),
                    href: stateHref("all"),
                  },
                  {
                    value: "draft",
                    label: t("filterDraft"),
                    href: stateHref("draft"),
                  },
                  {
                    value: "pending_approval",
                    label: t("filterPending"),
                    href: stateHref("pending_approval"),
                  },
                  {
                    value: "scheduled",
                    label: t("filterScheduled"),
                    href: stateHref("scheduled"),
                  },
                  {
                    value: "published",
                    label: t("filterPublished"),
                    href: stateHref("published"),
                  },
                  {
                    value: "archived",
                    label: t("filterArchived"),
                    href: stateHref("archived"),
                  },
                ],
              },
              {
                id: "feed-type-filter",
                label: t("filterType"),
                value: typeValue,
                options: [
                  {
                    value: "all",
                    label: t("typeAll"),
                    href: typeHref("all"),
                  },
                  {
                    value: "update",
                    label: t("typeUpdate"),
                    href: typeHref("update"),
                  },
                  {
                    value: "announcement",
                    label: t("typeAnnouncement"),
                    href: typeHref("announcement"),
                  },
                  {
                    value: "notice",
                    label: t("typeNotice"),
                    href: typeHref("notice"),
                  },
                ],
              },
            ]}
            chips={
              <>
                <FilterBar label={t("filterStatus")}>
                  <Button
                    asChild
                    variant={statusValue === "all" ? "default" : "secondary"}
                  >
                    <Link href={stateHref("all")}>{t("filterAll")}</Link>
                  </Button>
                  <Button
                    asChild
                    variant={statusValue === "draft" ? "default" : "secondary"}
                  >
                    <Link href={stateHref("draft")}>{t("filterDraft")}</Link>
                  </Button>
                  <Button
                    asChild
                    variant={
                      statusValue === "pending_approval"
                        ? "default"
                        : "secondary"
                    }
                  >
                    <Link href={stateHref("pending_approval")}>
                      {t("filterPending")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant={
                      statusValue === "scheduled" ? "default" : "secondary"
                    }
                  >
                    <Link href={stateHref("scheduled")}>
                      {t("filterScheduled")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant={
                      statusValue === "published" ? "default" : "secondary"
                    }
                  >
                    <Link href={stateHref("published")}>
                      {t("filterPublished")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant={
                      statusValue === "archived" ? "default" : "secondary"
                    }
                  >
                    <Link href={stateHref("archived")}>
                      {t("filterArchived")}
                    </Link>
                  </Button>
                </FilterBar>
                <FilterBar label={t("filterType")}>
                  <Button
                    asChild
                    variant={typeValue === "all" ? "default" : "secondary"}
                  >
                    <Link href={typeHref("all")}>{t("typeAll")}</Link>
                  </Button>
                  <Button
                    asChild
                    variant={typeValue === "update" ? "default" : "secondary"}
                  >
                    <Link href={typeHref("update")}>{t("typeUpdate")}</Link>
                  </Button>
                  <Button
                    asChild
                    variant={
                      typeValue === "announcement" ? "default" : "secondary"
                    }
                  >
                    <Link href={typeHref("announcement")}>
                      {t("typeAnnouncement")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant={typeValue === "notice" ? "default" : "secondary"}
                  >
                    <Link href={typeHref("notice")}>{t("typeNotice")}</Link>
                  </Button>
                </FilterBar>
              </>
            }
          />
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-3">
              {data.rows.map((row) => {
                const title = row.titleEn ?? t("untitled");
                return (
                  <li
                    key={row.id}
                    className="rounded-lg border border-border p-3"
                    data-testid="feed-admin-card"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        variant={feedStateBadgeVariant(row.state)}
                        label={tStatus(feedStateCopyKey(row.state))}
                      />
                      {row.isPinned ? (
                        <span className="text-xs font-medium">
                          {t("pinned")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-medium">{title}</p>
                    {canOpenPost ? (
                      <Button
                        asChild
                        variant="outline"
                        className="mt-3 min-h-11 w-full sm:w-auto"
                      >
                        <Link
                          href={`/admin/feed/${row.id}`}
                          aria-label={`${t("edit")}: ${title}`}
                        >
                          <Pencil aria-hidden="true" />
                          {t("edit")}
                        </Link>
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {canConfigure && data.moduleState !== "not_entitled" ? (
        <FeedSettingsForm
          venueId={current.id}
          data={data}
          writesBlocked={writesBlocked}
        />
      ) : null}
    </div>
  );
}
