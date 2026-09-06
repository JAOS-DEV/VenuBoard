import { Pencil, Eye } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { OffersSettingsForm } from "@/components/offers/offers-settings-form";
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
import { loadAdminOffers } from "@/core/offers/queries";
import {
  offerStateCopyKey,
  offerStateBadgeVariant,
  offerValidityLabel,
} from "@/core/offers/labels";
import { publicVenueOffersPath } from "@/core/offers/public-path";
import { moduleAvailabilityCopyKey } from "@/core/ui/status";

export const dynamic = "force-dynamic";

interface AdminOffersPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
}

export default async function AdminOffersPage({
  params,
  searchParams,
}: AdminOffersPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const { filter } = await searchParams;
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("offersAdmin");
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
  const canPublish =
    can(actor, "publish_content", scope) || can(actor, "manage_offers", scope);
  const canConfigure = can(actor, "manage_venue_module_visibility", scope);
  const canOpenOffer = canCreate || canSubmit || canApprove || canPublish;
  const hasAnyAccess = canOpenOffer || canConfigure;

  if (!hasAnyAccess) {
    return <p>{t("noAccess")}</p>;
  }

  const data = await loadAdminOffers(actor, current.id, filter);

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
    if (nextFilter === "all") {
      return "/admin/offers";
    }
    return `/admin/offers?filter=${nextFilter}`;
  };

  const statusValue =
    filter === "draft" ||
    filter === "pending_approval" ||
    filter === "scheduled" ||
    filter === "published" ||
    filter === "archived"
      ? filter
      : "all";
  const publicOffersHref = publicVenueOffersPath(current.slug);

  return (
    <div
      className="space-y-5"
      data-testid="offers-admin"
      data-venue-id={current.id}
    >
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <>
            {publicOffersHref !== null ? (
              <Button
                asChild
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
              >
                <Link href={publicOffersHref}>{t("viewPublic")}</Link>
              </Button>
            ) : null}
            {canCreate && moduleOk ? (
              <Button asChild className="min-h-11 w-full sm:w-auto">
                <Link href="/admin/offers/new">{t("create")}</Link>
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
                id: "offers-status-filter",
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
            ]}
            chips={
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
                    statusValue === "pending_approval" ? "default" : "secondary"
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
                  variant={statusValue === "archived" ? "default" : "secondary"}
                >
                  <Link href={stateHref("archived")}>
                    {t("filterArchived")}
                  </Link>
                </Button>
              </FilterBar>
            }
          />
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-3">
              {data.rows.map((row) => {
                const title = row.titleEn ?? t("untitled");
                const validity = offerValidityLabel(
                  row.validFrom,
                  row.validUntil,
                );
                const openLabel =
                  row.state === "draft" || row.state === "pending_approval"
                    ? t("edit")
                    : t("view");
                return (
                  <li
                    key={row.id}
                    className="rounded-lg border border-border p-3"
                    data-testid="offers-admin-card"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        variant={offerStateBadgeVariant(row.state)}
                        label={tStatus(offerStateCopyKey(row.state))}
                      />
                      <StatusBadge
                        variant="secondary"
                        label={
                          validity === "upcoming"
                            ? t("validityUpcoming")
                            : validity === "active"
                              ? t("validityActive")
                              : t("validityExpired")
                        }
                      />
                    </div>
                    <p className="mt-1 font-medium">{title}</p>
                    {canOpenOffer ? (
                      <Button
                        asChild
                        variant="outline"
                        className="mt-3 min-h-11 w-full sm:w-auto"
                      >
                        <Link
                          href={`/admin/offers/${row.id}`}
                          aria-label={`${openLabel}: ${title}`}
                        >
                          {row.state === "draft" ||
                          row.state === "pending_approval" ? (
                            <Pencil aria-hidden="true" />
                          ) : (
                            <Eye aria-hidden="true" />
                          )}
                          {openLabel}
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
        <OffersSettingsForm
          venueId={current.id}
          data={data}
          writesBlocked={writesBlocked}
        />
      ) : null}
    </div>
  );
}
