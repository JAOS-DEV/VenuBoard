"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  closeBookingEnquiryAction,
  reopenBookingEnquiryAction,
  reviewBookingEnquiryAction,
} from "@/core/booking-requests/actions";
import { BOOKING_OUTCOMES } from "@/core/booking-requests/constants";
import type { AdminBookingDetail } from "@/core/booking-requests/directory";
import {
  bookingOutcomeCopyKey,
  bookingStateBadgeVariant,
  bookingStateCopyKey,
  formatVenueLocalDateTime,
} from "@/core/booking-requests/labels";
import { StatusBadge } from "@/components/patterns/status-badge";

interface BookingAdminDetailProps {
  detail: AdminBookingDetail;
  timezone: string;
  locale: "en" | "th";
  canManage: boolean;
  canViewCustomer: boolean;
  writesBlocked: boolean;
}

function noticeFor(
  result: { ok: boolean; code?: string },
  copy: {
    saved: string;
    forbidden: string;
    conflict: string;
    genericError: string;
  },
): string {
  if (result.ok) {
    return copy.saved;
  }
  if (result.code === "forbidden") {
    return copy.forbidden;
  }
  if (result.code === "conflict") {
    return copy.conflict;
  }
  return copy.genericError;
}

export function BookingAdminDetail({
  detail,
  timezone,
  locale,
  canManage,
  canViewCustomer,
  writesBlocked,
}: BookingAdminDetailProps): React.ReactElement {
  const t = useTranslations("bookingAdmin");
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [outcome, setOutcome] =
    useState<(typeof BOOKING_OUTCOMES)[number]>("handled");

  const applyResult = (result: { ok: boolean; code?: string }): void => {
    setNotice(
      noticeFor(result, {
        saved: t("saved"),
        forbidden: t("forbidden"),
        conflict: t("conflict"),
        genericError: t("genericError"),
      }),
    );
    if (result.ok) {
      router.refresh();
    }
  };

  return (
    <div className="space-y-5" data-testid="booking-admin-detail">
      {notice !== null ? (
        <p className="text-sm" role="status">
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          variant={bookingStateBadgeVariant(detail.state)}
          label={t(bookingStateCopyKey(detail.state))}
        />
        {detail.closureOutcome !== null ? (
          <span className="text-sm text-muted-foreground">
            {t(bookingOutcomeCopyKey(detail.closureOutcome))}
          </span>
        ) : null}
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">{t("partySize")}</dt>
          <dd>{detail.partySize}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("requestedFor")}</dt>
          <dd>
            {formatVenueLocalDateTime(detail.requestedFor, timezone, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("timezone")}</dt>
          <dd>{timezone}</dd>
        </div>
      </dl>
      {canViewCustomer && detail.contact !== null ? (
        <section className="space-y-2 rounded-lg border border-border p-3">
          <h2 className="font-medium">{t("customerDetails")}</h2>
          <p>{detail.contact.displayName}</p>
          <p>{detail.contact.email}</p>
          {detail.contact.message !== null ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {detail.contact.message}
            </p>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">{t("customerHidden")}</p>
      )}
      {canManage && !writesBlocked ? (
        <div className="space-y-3">
          {detail.state === "new" ? (
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => {
                startTransition(() => {
                  void reviewBookingEnquiryAction({
                    enquiryId: detail.id,
                    expectedRowVersion: detail.rowVersion,
                  }).then(applyResult);
                });
              }}
            >
              {t("markInReview")}
            </Button>
          ) : null}
          {detail.state === "in_review" ? (
            <div className="space-y-2">
              <Label htmlFor="booking-outcome">{t("closeOutcome")}</Label>
              <select
                id="booking-outcome"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3"
                value={outcome}
                onChange={(event) => {
                  setOutcome(
                    event.target.value as (typeof BOOKING_OUTCOMES)[number],
                  );
                }}
              >
                {BOOKING_OUTCOMES.map((value) => (
                  <option key={value} value={value}>
                    {t(bookingOutcomeCopyKey(value))}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => {
                  startTransition(() => {
                    void closeBookingEnquiryAction({
                      enquiryId: detail.id,
                      expectedRowVersion: detail.rowVersion,
                      outcome,
                    }).then(applyResult);
                  });
                }}
              >
                {t("close")}
              </Button>
            </div>
          ) : null}
          {detail.state === "closed" ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => {
                startTransition(() => {
                  void reopenBookingEnquiryAction({
                    enquiryId: detail.id,
                    expectedRowVersion: detail.rowVersion,
                  }).then(applyResult);
                });
              }}
            >
              {t("reopen")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {writesBlocked && canManage ? (
        <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-medium">{t("historyTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("historyHelp")}</p>
        <ul className="space-y-2">
          {detail.events.map((event) => (
            <li key={`${event.occurredAt}-${event.action}`} className="text-sm">
              {event.action === "reviewed"
                ? t("historyReviewed")
                : event.action === "closed"
                  ? t("historyClosed")
                  : event.action === "reopened"
                    ? t("historyReopened")
                    : t("historyCreated")}{" "}
              · {formatVenueLocalDateTime(event.occurredAt, timezone, locale)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
