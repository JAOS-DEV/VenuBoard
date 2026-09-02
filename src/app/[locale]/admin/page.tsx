import { getTranslations } from "next-intl/server";

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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
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
      <Button asChild>
        <Link href="/admin/staff">{t("staffModule")}</Link>
      </Button>
    </div>
  );
}
