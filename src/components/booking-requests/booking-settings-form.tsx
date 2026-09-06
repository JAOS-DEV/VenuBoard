"use client";

import { startTransition, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateBookingSettingsAction } from "@/core/booking-requests/actions";
import type { AdminBookingData } from "@/core/booking-requests/directory";

interface BookingSettingsFormProps {
  venueId: string;
  data: AdminBookingData;
  writesBlocked: boolean;
}

function noticeFor(
  result: { ok: boolean; code?: string },
  copy: {
    saved: string;
    forbidden: string;
    unauthenticated: string;
    invalidPayload: string;
    genericError: string;
  },
): string {
  if (result.ok) {
    return copy.saved;
  }
  if (result.code === "forbidden") {
    return copy.forbidden;
  }
  if (result.code === "unauthenticated") {
    return copy.unauthenticated;
  }
  if (result.code === "invalid_payload") {
    return copy.invalidPayload;
  }
  return copy.genericError;
}

export function BookingSettingsForm({
  venueId,
  data,
  writesBlocked,
}: BookingSettingsFormProps): React.ReactElement {
  const t = useTranslations("bookingAdmin");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("moduleSettings")}</CardTitle>
        <CardDescription>{t("moduleSettingsHelp")}</CardDescription>
      </CardHeader>
      <CardContent>
        {writesBlocked ? (
          <p className="mb-3 text-sm text-muted-foreground">{t("readOnly")}</p>
        ) : null}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (writesBlocked) {
              return;
            }
            const form = new FormData(event.currentTarget);
            startTransition(() => {
              void updateBookingSettingsAction({
                venueId,
                isEnabled: form.get("isEnabled") === "on",
                isPubliclyVisible: form.get("isPubliclyVisible") === "on",
                acceptingEnquiries: form.get("acceptingEnquiries") === "on",
                minPartySize: Number(form.get("minPartySize")),
                maxPartySize: Number(form.get("maxPartySize")),
                horizonDays: Number(form.get("horizonDays")),
                leadTimeMinutes: Number(form.get("leadTimeMinutes")),
                headingEn: String(form.get("headingEn") ?? ""),
                headingTh: String(form.get("headingTh") ?? ""),
                instructionsEn: String(form.get("instructionsEn") ?? ""),
                instructionsTh: String(form.get("instructionsTh") ?? ""),
              }).then((result) => {
                setNotice(
                  noticeFor(result, {
                    saved: t("saved"),
                    forbidden: t("forbidden"),
                    unauthenticated: t("unauthenticated"),
                    invalidPayload: t("invalidPayload"),
                    genericError: t("genericError"),
                  }),
                );
              });
            });
          }}
        >
          {notice !== null ? (
            <p className="text-sm" role="status">
              {notice}
            </p>
          ) : null}
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="isEnabled"
              defaultChecked={data.isEnabled}
              disabled={writesBlocked}
              className="size-5"
            />
            {t("enabled")}
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="isPubliclyVisible"
              defaultChecked={data.isPubliclyVisible}
              disabled={writesBlocked}
              className="size-5"
            />
            {t("publiclyVisible")}
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="acceptingEnquiries"
              defaultChecked={data.acceptingEnquiries}
              disabled={writesBlocked}
              className="size-5"
            />
            {t("accepting")}
          </label>
          <div className="space-y-1">
            <Label htmlFor="booking-min-party">{t("minPartySize")}</Label>
            <Input
              id="booking-min-party"
              name="minPartySize"
              type="number"
              min={1}
              max={20}
              defaultValue={data.minPartySize}
              disabled={writesBlocked}
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-max-party">{t("maxPartySize")}</Label>
            <Input
              id="booking-max-party"
              name="maxPartySize"
              type="number"
              min={1}
              max={50}
              defaultValue={data.maxPartySize}
              disabled={writesBlocked}
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-horizon">{t("horizonDays")}</Label>
            <Input
              id="booking-horizon"
              name="horizonDays"
              type="number"
              min={1}
              max={365}
              defaultValue={data.horizonDays}
              disabled={writesBlocked}
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-lead">{t("leadTimeMinutes")}</Label>
            <Input
              id="booking-lead"
              name="leadTimeMinutes"
              type="number"
              min={0}
              max={10080}
              defaultValue={data.leadTimeMinutes}
              disabled={writesBlocked}
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-heading-en">{t("headingEn")}</Label>
            <Input
              id="booking-heading-en"
              name="headingEn"
              maxLength={80}
              defaultValue={data.headingEn ?? ""}
              disabled={writesBlocked}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-heading-th">{t("headingTh")}</Label>
            <Input
              id="booking-heading-th"
              name="headingTh"
              maxLength={80}
              defaultValue={data.headingTh ?? ""}
              disabled={writesBlocked}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-instructions-en">
              {t("instructionsEn")}
            </Label>
            <Textarea
              id="booking-instructions-en"
              name="instructionsEn"
              maxLength={500}
              defaultValue={data.instructionsEn}
              disabled={writesBlocked}
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-instructions-th">
              {t("instructionsTh")}
            </Label>
            <Textarea
              id="booking-instructions-th"
              name="instructionsTh"
              maxLength={500}
              defaultValue={data.instructionsTh}
              disabled={writesBlocked}
              rows={3}
            />
          </div>
          <Button type="submit" className="min-h-11" disabled={writesBlocked}>
            {t("saveSettings")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
