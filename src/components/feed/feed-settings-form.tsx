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
import { updateFeedSettingsAction } from "@/core/feed/actions";
import type { AdminFeedData } from "@/core/feed/directory";

interface FeedSettingsFormProps {
  venueId: string;
  data: AdminFeedData;
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

export function FeedSettingsForm({
  venueId,
  data,
  writesBlocked,
}: FeedSettingsFormProps): React.ReactElement {
  const t = useTranslations("feedAdmin");
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
              void updateFeedSettingsAction({
                venueId,
                isEnabled: form.get("isEnabled") === "on",
                isPubliclyVisible: form.get("isPubliclyVisible") === "on",
                requireManagerApproval:
                  form.get("requireManagerApproval") === "on",
                homepagePreviewEnabled:
                  form.get("homepagePreviewEnabled") === "on",
                homepagePreviewCount: Number(form.get("homepagePreviewCount")),
                horizonDays: Number(form.get("horizonDays")),
                displayDensity: form.get("displayDensity"),
                headingEn: String(form.get("headingEn") ?? ""),
                headingTh: String(form.get("headingTh") ?? ""),
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
              name="requireManagerApproval"
              defaultChecked={data.approvalRequired}
              disabled={writesBlocked}
              className="size-5"
            />
            {t("requireApproval")}
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="homepagePreviewEnabled"
              defaultChecked={data.homepagePreviewEnabled}
              disabled={writesBlocked}
              className="size-5"
            />
            {t("homepagePreview")}
          </label>
          <div className="space-y-1">
            <Label htmlFor="feed-preview-count">{t("previewCount")}</Label>
            <Input
              id="feed-preview-count"
              name="homepagePreviewCount"
              type="number"
              min={1}
              max={6}
              defaultValue={data.homepagePreviewCount}
              disabled={writesBlocked}
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feed-horizon">{t("horizonDays")}</Label>
            <Input
              id="feed-horizon"
              name="horizonDays"
              type="number"
              min={1}
              max={730}
              defaultValue={data.horizonDays}
              disabled={writesBlocked}
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feed-density">{t("displayDensity")}</Label>
            <select
              id="feed-density"
              name="displayDensity"
              defaultValue={data.displayDensity}
              disabled={writesBlocked}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3"
            >
              <option value="comfortable">{t("densityComfortable")}</option>
              <option value="compact">{t("densityCompact")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="feed-heading-en">{t("headingEn")}</Label>
            <Input
              id="feed-heading-en"
              name="headingEn"
              maxLength={80}
              defaultValue={data.headingEn ?? ""}
              disabled={writesBlocked}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feed-heading-th">{t("headingTh")}</Label>
            <Input
              id="feed-heading-th"
              name="headingTh"
              maxLength={80}
              defaultValue={data.headingTh ?? ""}
              disabled={writesBlocked}
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
