import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { OffersAdminPanel } from "@/components/offers/offers-admin-panel";
import { PageHeader } from "@/components/patterns/page-header";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { loadAdminOfferDetail, loadAdminOffers } from "@/core/offers/queries";
import { publicVenueOffersPath } from "@/core/offers/public-path";
import { venueInstantToLocalInput } from "@/core/offers/timezone";

export const dynamic = "force-dynamic";

interface EditOfferPageProps {
  params: Promise<{ locale: string; offerId: string }>;
}

export default async function EditOfferPage({
  params,
}: EditOfferPageProps): Promise<React.ReactElement> {
  const awaited = await params;
  const locale = await resolveRequestLocale(
    Promise.resolve({ locale: awaited.locale }),
  );
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

  const detail = await loadAdminOfferDetail(current.id, awaited.offerId);
  if (detail === null) {
    redirect(`/${locale}/admin/offers`);
  }

  const scope = {
    type: "venue" as const,
    venueId: current.id,
    businessId: current.businessId,
  };
  const data = await loadAdminOffers(actor, current.id);

  return (
    <div className="space-y-5">
      <PageHeader title={t("editTitle")} description={t("editHelp")} />
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
          id: detail.id,
          titleEn: detail.titleEn ?? "",
          descriptionEn: detail.descriptionEn ?? "",
          termsEn: detail.termsEn ?? "",
          titleTh: detail.titleTh ?? "",
          descriptionTh: detail.descriptionTh ?? "",
          termsTh: detail.termsTh ?? "",
          validFromLocal: venueInstantToLocalInput(
            new Date(detail.validFrom),
            data.timezone,
          ),
          validUntilLocal: venueInstantToLocalInput(
            new Date(detail.validUntil),
            data.timezone,
          ),
          validFrom: detail.validFrom,
          validUntil: detail.validUntil,
          state: detail.state,
          scheduledForLocal: detail.scheduledFor
            ? venueInstantToLocalInput(
                new Date(detail.scheduledFor),
                data.timezone,
              )
            : "",
          rejectionReason: detail.rejectionReason,
          approvedAt: detail.approvedAt,
          quarantined: detail.quarantined,
          history: detail.history,
        }}
      />
    </div>
  );
}
