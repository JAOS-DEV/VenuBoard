"use client";

import { startTransition, useId, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitBookingEnquiryAction } from "@/core/booking-requests/actions";
import {
  BOOKING_EMAIL_MAX,
  BOOKING_MESSAGE_MAX,
  BOOKING_NAME_MAX,
} from "@/core/booking-requests/constants";
import type { PublicBookingIntakePayload } from "@/core/booking-requests/public-types";

interface PublicBookingFormProps {
  intake: PublicBookingIntakePayload;
  locale: "en" | "th";
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function noticeFor(
  result: { ok: boolean; code?: string },
  copy: {
    sent: string;
    invalidPayload: string;
    conflict: string;
    genericError: string;
  },
): string {
  if (result.ok) {
    return copy.sent;
  }
  if (result.code === "invalid_payload") {
    return copy.invalidPayload;
  }
  if (result.code === "conflict") {
    return copy.conflict;
  }
  return copy.genericError;
}

export function PublicBookingForm({
  intake,
  locale,
}: PublicBookingFormProps): React.ReactElement {
  const t = useTranslations("bookingPublic");
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const formId = useId();
  const minLocal = intake.minLocal;
  const maxLocal = intake.maxLocal;
  const defaultLocal =
    intake.defaultLocal.length > 0 ? intake.defaultLocal : minLocal;

  return (
    <form
      className="space-y-4"
      data-testid="public-booking-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (sent) {
          return;
        }
        const form = new FormData(event.currentTarget);
        const message = String(form.get("message") ?? "").trim();
        startTransition(() => {
          void submitBookingEnquiryAction({
            venueSlug: intake.venueSlug,
            displayName: String(form.get("displayName") ?? ""),
            email: String(form.get("email") ?? ""),
            partySize: Number(form.get("partySize")),
            requestedLocal: String(form.get("requestedLocal") ?? ""),
            locale,
            message: message.length > 0 ? message : undefined,
            idempotencyKey,
          }).then((result) => {
            setNotice(
              noticeFor(result, {
                sent: t("sent"),
                invalidPayload: t("invalidPayload"),
                conflict: t("conflict"),
                genericError: t("genericError"),
              }),
            );
            if (result.ok) {
              setSent(true);
            }
          });
        });
      }}
    >
      {notice !== null ? (
        <p className="text-sm" role="status">
          {notice}
        </p>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor={`${formId}-name`}>{t("displayName")}</Label>
        <Input
          id={`${formId}-name`}
          name="displayName"
          autoComplete="name"
          required
          maxLength={BOOKING_NAME_MAX}
          disabled={sent}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${formId}-email`}>{t("email")}</Label>
        <Input
          id={`${formId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={BOOKING_EMAIL_MAX}
          disabled={sent}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${formId}-party`}>{t("partySize")}</Label>
        <Input
          id={`${formId}-party`}
          name="partySize"
          type="number"
          min={intake.minPartySize}
          max={intake.maxPartySize}
          defaultValue={intake.minPartySize}
          required
          disabled={sent}
          className="h-11"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${formId}-when`}>{t("requestedFor")}</Label>
        <Input
          id={`${formId}-when`}
          name="requestedLocal"
          type="datetime-local"
          required
          min={minLocal}
          max={maxLocal}
          defaultValue={defaultLocal}
          disabled={sent}
        />
        <p className="text-xs text-muted-foreground">
          {t("timezoneHelp", { timezone: intake.timezone })}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${formId}-message`}>{t("message")}</Label>
        <Textarea
          id={`${formId}-message`}
          name="message"
          maxLength={BOOKING_MESSAGE_MAX}
          disabled={sent}
          rows={4}
        />
      </div>
      <p className="text-sm text-muted-foreground">{t("ack")}</p>
      <Button
        type="submit"
        className="min-h-11 w-full sm:w-auto"
        disabled={sent}
      >
        {t("submit")}
      </Button>
    </form>
  );
}
