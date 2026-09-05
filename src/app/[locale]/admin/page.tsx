import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/patterns/page-header";
import { VenueScopeForm } from "@/components/staff-presence/venue-scope-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { Link } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";

export const dynamic = "force-dynamic";

interface AdminPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminPage({
  params,
}: AdminPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("admin");
  const venues = isActiveAuthenticatedActor(actor)
    ? await listAdminVenues(actor)
    : [];
  const currentVenueId =
    actor.kind === "authenticated" ? actor.currentVenueId : null;

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("intro")} />
      {venues.length > 1 ? (
        <VenueScopeForm
          venues={venues}
          currentVenueId={currentVenueId}
          label={t("venueSelector")}
          submitLabel={t("useVenue")}
        />
      ) : null}
      {venues.length === 1 ? (
        <p>
          <Badge variant="outline">{venues[0]?.name}</Badge>
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <Button asChild className="h-auto w-full justify-start px-4 py-3">
            <Link href="/admin/staff">
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span>{t("staffModule")}</span>
                <span className="text-xs font-normal text-primary-foreground/80">
                  {t("staffModuleHelp")}
                </span>
              </span>
            </Link>
          </Button>
        </li>
        <li>
          <Button
            asChild
            variant="secondary"
            className="h-auto w-full justify-start px-4 py-3"
          >
            <Link href="/admin/events">
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span>{t("eventsModule")}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t("eventsModuleHelp")}
                </span>
              </span>
            </Link>
          </Button>
        </li>
        <li>
          <Button
            asChild
            variant="secondary"
            className="h-auto w-full justify-start px-4 py-3"
          >
            <Link href="/admin/feed">
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span>{t("feedModule")}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t("feedModuleHelp")}
                </span>
              </span>
            </Link>
          </Button>
        </li>
        <li>
          <Button
            asChild
            variant="secondary"
            className="h-auto w-full justify-start px-4 py-3"
          >
            <Link href="/admin/atmosphere">
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span>{t("atmosphereModule")}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t("atmosphereModuleHelp")}
                </span>
              </span>
            </Link>
          </Button>
        </li>
      </ul>
    </div>
  );
}
