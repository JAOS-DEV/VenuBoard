import { getTranslations } from "next-intl/server";

import { NotImplementedNotice } from "@/components/not-implemented-notice";
import { Badge } from "@/components/ui/badge";
import { resolveRequestLocale } from "@/core/i18n/server";

/**
 * Development fallback route for a public venue site.
 *
 * `/v/[venueSlug]` is the documented permanent fallback used in local
 * development (ADR-020). Production resolution order — verified custom domain,
 * then VenuBoard subdomain, then this path — is not implemented, and neither is
 * any tenant lookup. This page echoes the slug and says so.
 */
interface PublicVenuePageProps {
  params: Promise<{ locale: string; venueSlug: string }>;
}

export default async function PublicVenuePage({
  params,
}: PublicVenuePageProps): Promise<React.ReactElement> {
  const { venueSlug } = await params;
  await resolveRequestLocale(params);

  const t = await getTranslations("publicVenue");

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Badge variant="outline">{t("developmentFallback")}</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      </header>

      <NotImplementedNotice
        heading={t("slugLabel")}
        body={t("notImplemented")}
        note={t("routingNote")}
      >
        <p className="font-mono text-base text-foreground">{venueSlug}</p>
      </NotImplementedNotice>
    </div>
  );
}
