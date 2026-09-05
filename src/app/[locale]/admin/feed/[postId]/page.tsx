import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FeedAdminPanel } from "@/components/feed/feed-admin-panel";
import { PageHeader } from "@/components/patterns/page-header";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { loadAdminFeed, loadAdminFeedDetail } from "@/core/feed/queries";
import { publicVenueUpdatesPath } from "@/core/feed/public-path";

export const dynamic = "force-dynamic";

interface EditFeedPageProps {
  params: Promise<{ locale: string; postId: string }>;
}

export default async function EditFeedPage({
  params,
}: EditFeedPageProps): Promise<React.ReactElement> {
  const awaited = await params;
  const locale = await resolveRequestLocale(
    Promise.resolve({ locale: awaited.locale }),
  );
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("feedAdmin");

  if (!isActiveAuthenticatedActor(actor)) {
    redirect(`/${locale}/sign-in`);
  }

  const venues = await listAdminVenues(actor);
  const current =
    venues.find((row) => row.id === actor.currentVenueId) ?? venues[0];
  if (current === undefined) {
    redirect(`/${locale}/admin/feed`);
  }

  const detail = await loadAdminFeedDetail(current.id, awaited.postId);
  if (detail === null) {
    redirect(`/${locale}/admin/feed`);
  }

  const scope = {
    type: "venue" as const,
    venueId: current.id,
    businessId: current.businessId,
  };
  const data = await loadAdminFeed(actor, current.id, current.businessId);

  return (
    <div className="space-y-5">
      <PageHeader title={t("editTitle")} description={t("editHelp")} />
      <FeedAdminPanel
        venueId={current.id}
        moduleState={data.moduleState}
        approvalRequired={data.approvalRequired}
        capabilities={{
          canCreate: can(actor, "create_content", scope),
          canEdit: can(actor, "create_content", scope),
          canSubmit: can(actor, "submit_content_for_approval", scope),
          canApprove: can(actor, "approve_content", scope),
          canPublish:
            can(actor, "publish_content", scope) ||
            (!data.approvalRequired && can(actor, "create_content", scope)),
          canCopyToVenues:
            can(actor, "create_content", scope) &&
            data.copyDestinations.length > 0,
        }}
        availableCopyDestinations={data.copyDestinations}
        publicUpdatesHref={publicVenueUpdatesPath(current.slug)}
        post={{
          id: detail.id,
          postType: detail.postType,
          titleEn: detail.titleEn ?? "",
          bodyEn: detail.bodyEn ?? "",
          titleTh: detail.titleTh ?? "",
          bodyTh: detail.bodyTh ?? "",
          state: detail.state,
          isPinned: detail.isPinned,
          scheduledFor: detail.scheduledFor
            ? detail.scheduledFor.slice(0, 16)
            : "",
          rejectionReason: detail.rejectionReason,
          approvedAt: detail.approvedAt,
        }}
      />
    </div>
  );
}
