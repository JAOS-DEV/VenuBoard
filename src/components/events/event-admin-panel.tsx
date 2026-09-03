"use client";

import { startTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEventAction,
  updateEventDraftAction,
  submitEventForApprovalAction,
  approveEventAction,
  rejectEventAction,
  publishEventNowAction,
  scheduleEventPublicationAction,
  cancelEventAction,
  archiveEventAction,
  restoreEventToDraftAction,
  copyEventToVenueAction,
} from "@/core/events/actions";
import type { EventActionResult } from "@/core/events/result";

interface EventCapabilities {
  canCreate: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canManageLifecycle: boolean;
  canConfigureModule: boolean;
  canCopyToVenues: boolean;
}

interface EventData {
  id: string;
  state: string;
  approvalStatus: string;
  rejectionReason: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  isAllDay: boolean;
  publishAt: string | null;
  cancelledAt: string | null;
  archivedAt: string | null;
  posterStoragePath: string | null;
  titleEn: string | null;
  summaryEn: string | null;
  descriptionEn: string | null;
  ctaLabelEn: string | null;
  titleTh: string | null;
  summaryTh: string | null;
  descriptionTh: string | null;
  ctaLabelTh: string | null;
}

export interface EventAdminPanelProps {
  venueId: string;
  venueTimezone: string;
  locale: string;
  moduleState: string;
  approvalRequired: boolean;
  capabilities: EventCapabilities;
  availableCopyDestinations: Array<{ id: string; name: string }>;
  event?: EventData | null;
}

function StateBadge({
  state,
  approvalStatus,
}: {
  state: string;
  approvalStatus: string;
}) {
  const t = useTranslations("eventsAdmin");
  const label =
    state === "draft" && approvalStatus === "pending"
      ? t("pendingApproval")
      : state === "draft"
        ? t("draft")
        : state === "published"
          ? t("published")
          : state === "scheduled"
            ? t("scheduled")
            : state === "cancelled"
              ? t("cancelled")
              : state === "archived"
                ? t("archived")
                : state;
  return <Badge variant="outline">{label}</Badge>;
}

function StatusMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mt-2 text-sm text-muted-foreground">{message}</p>;
}

export function EventAdminPanel({
  venueId,
  venueTimezone,
  moduleState,
  approvalRequired,
  capabilities,
  availableCopyDestinations,
  event,
}: EventAdminPanelProps): React.ReactElement {
  const t = useTranslations("eventsAdmin");

  const [titleEn, setTitleEn] = useState(event?.titleEn ?? "");
  const [summaryEn, setSummaryEn] = useState(event?.summaryEn ?? "");
  const [descriptionEn, setDescriptionEn] = useState(
    event?.descriptionEn ?? "",
  );
  const [ctaLabelEn, setCtaLabelEn] = useState(event?.ctaLabelEn ?? "");
  const [titleTh, setTitleTh] = useState(event?.titleTh ?? "");
  const [summaryTh, setSummaryTh] = useState(event?.summaryTh ?? "");
  const [descriptionTh, setDescriptionTh] = useState(
    event?.descriptionTh ?? "",
  );
  const [ctaLabelTh, setCtaLabelTh] = useState(event?.ctaLabelTh ?? "");
  const [startsAt, setStartsAt] = useState(() => {
    if (event?.startsAt) return event.startsAt;
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return `${start.toISOString().slice(0, 16)}:00Z`;
  });
  const [endsAt, setEndsAt] = useState(() => {
    if (event?.endsAt) return event.endsAt;
    const end = new Date(Date.now() + 26 * 60 * 60 * 1000);
    return `${end.toISOString().slice(0, 16)}:00Z`;
  });
  const [isAllDay, setIsAllDay] = useState(event?.isAllDay ?? false);
  const [posterStoragePath, setPosterStoragePath] = useState(
    event?.posterStoragePath ?? "",
  );
  const [publishAt, setPublishAt] = useState(event?.publishAt ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [copyDestVenueId, setCopyDestVenueId] = useState(
    availableCopyDestinations[0]?.id ?? "",
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (
    moduleState !== "enabled" &&
    moduleState !== "trial" &&
    moduleState !== "entitled_disabled"
  ) {
    return <p>{t("unavailable")}</p>;
  }

  function buildPayload() {
    return {
      venueId,
      startsAt,
      endsAt,
      timezone: venueTimezone,
      isAllDay,
      titleEn,
      summaryEn: summaryEn || undefined,
      descriptionEn: descriptionEn || undefined,
      ctaLabelEn: ctaLabelEn || undefined,
      titleTh: titleTh || undefined,
      summaryTh: summaryTh || undefined,
      descriptionTh: descriptionTh || undefined,
      ctaLabelTh: ctaLabelTh || undefined,
      posterStoragePath: posterStoragePath || undefined,
    };
  }

  function handleResult(result: EventActionResult) {
    if (result.ok) {
      setStatusMsg(t("saved"));
    } else {
      const code = result.code;
      const msg =
        code === "forbidden"
          ? t("forbidden")
          : code === "not_found"
            ? t("notFound")
            : code === "conflict"
              ? t("conflict")
              : t("genericError");
      setStatusMsg(msg);
    }
    setPending(false);
  }

  function run(fn: () => Promise<EventActionResult>) {
    setPending(true);
    setStatusMsg(null);
    startTransition(() => {
      fn()
        .then(handleResult)
        .catch(() => {
          setStatusMsg(t("genericError"));
          setPending(false);
        });
    });
  }

  const canSaveDraft = !event
    ? capabilities.canCreate
    : capabilities.canEdit &&
      (event.state === "draft" || event.state === "rejected");

  const canSubmit =
    capabilities.canSubmit && approvalRequired && event?.state === "draft";

  const canApprove =
    capabilities.canApprove && event?.approvalStatus === "pending";

  const canPublishNow =
    (capabilities.canPublish ||
      (!approvalRequired && capabilities.canCreate)) &&
    event !== null &&
    event !== undefined &&
    (event.state === "draft" || event.state === "approved");

  const canSchedule = canPublishNow;

  const canCancel =
    capabilities.canManageLifecycle &&
    event !== null &&
    event !== undefined &&
    (event.state === "published" || event.state === "scheduled");

  const canArchive =
    capabilities.canManageLifecycle &&
    event !== null &&
    event !== undefined &&
    (event.state === "published" ||
      event.state === "cancelled" ||
      event.state === "draft");

  const canRestore =
    capabilities.canManageLifecycle &&
    event !== null &&
    event !== undefined &&
    (event.state === "cancelled" ||
      event.state === "archived" ||
      event.state === "draft");

  const canCopy =
    capabilities.canCopyToVenues &&
    event !== null &&
    event !== undefined &&
    availableCopyDestinations.length > 0;

  return (
    <div className="space-y-6">
      {event ? (
        <div className="flex items-center gap-2">
          <StateBadge
            state={event.state}
            approvalStatus={event.approvalStatus}
          />
          {event.rejectionReason ? (
            <span className="text-sm text-destructive">
              {t("rejectionReason")}: {event.rejectionReason}
            </span>
          ) : null}
        </div>
      ) : null}

      {approvalRequired ? (
        <p className="text-sm text-muted-foreground">{t("approvalRequired")}</p>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title-en">{t("titleEn")}</Label>
          <Input
            id="title-en"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            maxLength={160}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="summary-en">{t("summaryEn")}</Label>
          <Input
            id="summary-en"
            value={summaryEn}
            onChange={(e) => setSummaryEn(e.target.value)}
            maxLength={280}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description-en">{t("descriptionEn")}</Label>
          <textarea
            id="description-en"
            className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            maxLength={8000}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cta-en">{t("ctaLabelEn")}</Label>
          <Input
            id="cta-en"
            value={ctaLabelEn}
            onChange={(e) => setCtaLabelEn(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="title-th">{t("titleTh")}</Label>
          <Input
            id="title-th"
            value={titleTh}
            onChange={(e) => setTitleTh(e.target.value)}
            maxLength={160}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="summary-th">{t("summaryTh")}</Label>
          <Input
            id="summary-th"
            value={summaryTh}
            onChange={(e) => setSummaryTh(e.target.value)}
            maxLength={280}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description-th">{t("descriptionTh")}</Label>
          <textarea
            id="description-th"
            className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={descriptionTh}
            onChange={(e) => setDescriptionTh(e.target.value)}
            maxLength={8000}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cta-th">{t("ctaLabelTh")}</Label>
          <Input
            id="cta-th"
            value={ctaLabelTh}
            onChange={(e) => setCtaLabelTh(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="is-all-day"
            type="checkbox"
            checked={isAllDay}
            onChange={(e) => setIsAllDay(e.target.checked)}
          />
          <Label htmlFor="is-all-day">{t("isAllDay")}</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="starts-at">{t("startsAt")}</Label>
          <Input
            id="starts-at"
            type="datetime-local"
            value={startsAt.slice(0, 16)}
            onChange={(e) => setStartsAt(e.target.value + ":00Z")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ends-at">{t("endsAt")}</Label>
          <Input
            id="ends-at"
            type="datetime-local"
            value={endsAt.slice(0, 16)}
            onChange={(e) => setEndsAt(e.target.value + ":00Z")}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("posterDeferred")}</p>
          <Label htmlFor="poster-path">{t("posterStoragePath")}</Label>
          <Input
            id="poster-path"
            value={posterStoragePath}
            onChange={(e) => setPosterStoragePath(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canSaveDraft ? (
          <Button
            disabled={pending}
            onClick={() => {
              if (!event) {
                run(
                  () =>
                    createEventAction(
                      buildPayload(),
                    ) as Promise<EventActionResult>,
                );
              } else {
                run(() =>
                  updateEventDraftAction({
                    eventId: event.id,
                    startsAt,
                    endsAt,
                    timezone: venueTimezone,
                    isAllDay,
                    titleEn,
                    summaryEn: summaryEn || undefined,
                    descriptionEn: descriptionEn || undefined,
                    ctaLabelEn: ctaLabelEn || undefined,
                    titleTh: titleTh || undefined,
                    summaryTh: summaryTh || undefined,
                    descriptionTh: descriptionTh || undefined,
                    ctaLabelTh: ctaLabelTh || undefined,
                    posterStoragePath: posterStoragePath || undefined,
                  }),
                );
              }
            }}
          >
            {t("saveDraft")}
          </Button>
        ) : null}

        {canSubmit && event ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => submitEventForApprovalAction(event.id))}
          >
            {t("submitForApproval")}
          </Button>
        ) : null}

        {canApprove && event ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => approveEventAction(event.id))}
          >
            {t("approve")}
          </Button>
        ) : null}

        {canApprove && event ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder={t("rejectionReason")}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <Button
              variant="destructive"
              disabled={pending || !rejectReason}
              onClick={() =>
                run(() =>
                  rejectEventAction({
                    eventId: event.id,
                    reason: rejectReason,
                  }),
                )
              }
            >
              {t("reject")}
            </Button>
          </div>
        ) : null}

        {canPublishNow && event ? (
          <Button
            disabled={pending}
            onClick={() => run(() => publishEventNowAction(event.id))}
          >
            {t("publishNow")}
          </Button>
        ) : null}

        {canSchedule && event ? (
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={publishAt.slice(0, 16)}
              onChange={(e) => setPublishAt(e.target.value + ":00Z")}
            />
            <Button
              variant="outline"
              disabled={pending || !publishAt}
              onClick={() =>
                run(() =>
                  scheduleEventPublicationAction({
                    eventId: event.id,
                    publishAt,
                  }),
                )
              }
            >
              {t("schedulePublication")}
            </Button>
          </div>
        ) : null}

        {canCancel && event ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder={t("confirmCancel")}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(() =>
                  cancelEventAction({
                    eventId: event.id,
                    reason: cancelReason || undefined,
                  }),
                )
              }
            >
              {t("cancel")}
            </Button>
          </div>
        ) : null}

        {canArchive && event ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => archiveEventAction(event.id))}
          >
            {t("archive")}
          </Button>
        ) : null}

        {canRestore && event ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => restoreEventToDraftAction(event.id))}
          >
            {t("restoreToDraft")}
          </Button>
        ) : null}

        {canCopy && event && availableCopyDestinations.length > 0 ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="copy-dest">{t("copyDestination")}</Label>
            <select
              id="copy-dest"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={copyDestVenueId}
              onChange={(e) => setCopyDestVenueId(e.target.value)}
            >
              {availableCopyDestinations.map((dest) => (
                <option key={dest.id} value={dest.id}>
                  {dest.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={pending || !copyDestVenueId}
              onClick={() =>
                run(
                  () =>
                    copyEventToVenueAction({
                      eventId: event.id,
                      destVenueId: copyDestVenueId,
                    }) as Promise<EventActionResult>,
                )
              }
            >
              {t("copyToVenue")}
            </Button>
          </div>
        ) : null}
      </div>

      <StatusMessage message={statusMsg} />
    </div>
  );
}
