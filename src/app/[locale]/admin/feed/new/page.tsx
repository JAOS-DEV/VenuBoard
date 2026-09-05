import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FeedAdminPanel } from "@/components/feed/feed-admin-panel";
import { PageHeader } from "@/components/patterns/page-header";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";
import { loadAdminFeed } from "@/core/feed/queries";
import { publicVenueUpdatesPath } from "@/core/feed/public-path";

export const dynamic = "force-dynamic";

interface NewFeedPageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewFeedPage({
  params,
}: NewFeedPageProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
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

  const scope = {
    type: "venue" as const,
    venueId: current.id,
    businessId: current.businessId,
  };
  const data = await loadAdminFeed(actor, current.id, current.businessId);

  return (
    <div className="space-y-5">
      <PageHeader title={t("createTitle")} description={t("createHelp")} />
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
      />
    </div>
  );
}
