import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { OffersAdminPanel } from "@/components/offers/offers-admin-panel";
import { PageHeader } from "@/components/patterns/page-header";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { loadAdminOffers } from "@/core/offers/queries";
import { publicVenueOffersPath } from "@/core/offers/public-path";
import { venueInstantToLocalInput } from "@/core/offers/timezone";

export const dynamic = "force-dynamic";

interface NewOfferPageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewOfferPage({
  params,
}: NewOfferPageProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("offersAdmin");

  if (!isActiveAuthenticatedActor(actor)) {
    redirect(`/${locale}/sign-in`);
  }

  const venues = await listAdminVenues(actor);
  const current =
    venues.find((row) => row.id === actor.currentVenueId) ?? venues[0];
  if (current === undefined) {
    redirect(`/${locale}/admin/offers`);
  }

  const scope = {
    type: "venue" as const,
    venueId: current.id,
    businessId: current.businessId,
  };
  const data = await loadAdminOffers(actor, current.id);
  const now = new Date();
  const validFromLocal = venueInstantToLocalInput(now, data.timezone);
  const validUntilLocal = venueInstantToLocalInput(
    new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    data.timezone,
  );

  return (
    <div className="space-y-5">
      <PageHeader title={t("createTitle")} description={t("createHelp")} />
      <OffersAdminPanel
        venueId={current.id}
        timezone={data.timezone}
        moduleState={data.moduleState}
        approvalRequired={data.approvalRequired}
        capabilities={{
          canCreate: can(actor, "create_content", scope),
          canEdit: can(actor, "create_content", scope),
          canSubmit: can(actor, "submit_content_for_approval", scope),
          canApprove: can(actor, "approve_content", scope),
          canPublish:
            can(actor, "publish_content", scope) ||
            can(actor, "manage_offers", scope) ||
            (!data.approvalRequired && can(actor, "create_content", scope)),
        }}
        publicOffersHref={publicVenueOffersPath(current.slug)}
        offer={{
          id: null,
          titleEn: "",
          descriptionEn: "",
          termsEn: "",
          titleTh: "",
          descriptionTh: "",
          termsTh: "",
          validFromLocal,
          validUntilLocal,
          validFrom: now.toISOString(),
          validUntil: new Date(
            now.getTime() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          state: "draft",
          scheduledForLocal: "",
          rejectionReason: null,
          approvedAt: null,
          quarantined: false,
          history: [],
        }}
      />
    </div>
  );
}
