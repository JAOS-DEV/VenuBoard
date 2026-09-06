import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BookingAdminDetail } from "@/components/booking-requests/booking-admin-detail";
import { PageHeader } from "@/components/patterns/page-header";
import { resolveRequestActor } from "@/core/actors/resolve";
import { isActiveAuthenticatedActor } from "@/core/actors/types";
import { can } from "@/core/authz/can";
import {
  loadAdminBookingDetail,
  loadAdminBookings,
} from "@/core/booking-requests/queries";
import { resolveRequestLocale } from "@/core/i18n/server";
import { listAdminVenues } from "@/core/staff-presence/queries";

export const dynamic = "force-dynamic";

interface AdminBookingDetailPageProps {
  params: Promise<{ locale: string; enquiryId: string }>;
}

export default async function AdminBookingDetailPage({
  params,
}: AdminBookingDetailPageProps): Promise<React.ReactElement> {
  const awaited = await params;
  const locale = await resolveRequestLocale(
    Promise.resolve({ locale: awaited.locale }),
  );
  const actor = await resolveRequestActor({ memberships: "own" });
  const t = await getTranslations("bookingAdmin");

  if (!isActiveAuthenticatedActor(actor)) {
    redirect(`/${locale}/sign-in`);
  }

  const venues = await listAdminVenues(actor);
  const current =
    venues.find((row) => row.id === actor.currentVenueId) ?? venues[0];
  if (current === undefined) {
    redirect(`/${locale}/admin/bookings`);
  }

  const scope = {
    type: "venue" as const,
    venueId: current.id,
    businessId: current.businessId,
  };
  const canView = can(actor, "view_bookings", scope);
  const canManage = can(actor, "manage_bookings", scope);
  const canViewCustomer = can(actor, "view_booking_customer_details", scope);

  if (!canView && !canManage && !canViewCustomer) {
    redirect(`/${locale}/admin/bookings`);
  }

  const detail = await loadAdminBookingDetail(
    current.id,
    awaited.enquiryId,
    canViewCustomer,
  );
  if (detail === null) {
    redirect(`/${locale}/admin/bookings`);
  }

  const data = await loadAdminBookings(current.id);
  const writesBlocked =
    data.moduleState === "restricted" || data.moduleState === "suspended";

  return (
    <div className="space-y-5">
      <PageHeader title={t("detailTitle")} description={t("detailHelp")} />
      <BookingAdminDetail
        detail={detail}
        timezone={data.timezone}
        locale={locale === "th" ? "th" : "en"}
        canManage={canManage}
        canViewCustomer={canViewCustomer}
        writesBlocked={writesBlocked}
      />
    </div>
  );
}
