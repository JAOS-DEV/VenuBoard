"use client";

import { startTransition, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Link, useRouter } from "@/core/i18n/navigation";
import {
  approveOfferAction,
  archiveOfferAction,
  createOfferAction,
  publishOfferNowAction,
  rejectOfferAction,
  restoreOfferAction,
  scheduleOfferAction,
  submitOfferAction,
  unpublishOfferAction,
  updateOfferDraftAction,
} from "@/core/offers/actions";
import {
  offerStateBadgeVariant,
  offerStateCopyKey,
  offerValidityLabel,
} from "@/core/offers/labels";
import type { OfferActionResult } from "@/core/offers/result";
import {
  parseVenueLocalDateTime,
  venueLocalDateTimeToUtc,
} from "@/core/offers/timezone";
import type { AdminOfferHistoryRow } from "@/core/offers/directory";

interface OfferCapabilities {
  canCreate: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canPublish: boolean;
}

interface OfferFormState {
  id: string | null;
  titleEn: string;
  descriptionEn: string;
  termsEn: string;
  titleTh: string;
  descriptionTh: string;
  termsTh: string;
  validFromLocal: string;
  validUntilLocal: string;
  validFrom: string;
  validUntil: string;
  state: string;
  scheduledForLocal: string;
  rejectionReason: string | null;
  approvedAt: string | null;
  quarantined: boolean;
  history: AdminOfferHistoryRow[];
}

export interface OffersAdminPanelProps {
  venueId: string;
  timezone: string;
  moduleState: string;
  approvalRequired: boolean;
  capabilities: OfferCapabilities;
  publicOffersHref?: string | null;
  offer?: OfferFormState | null;
}

function noticeFor(
  result: { ok: boolean; code?: string },
  copy: {
    saved: string;
    forbidden: string;
    unauthenticated: string;
    invalidPayload: string;
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
  if (result.code === "unauthenticated") {
    return copy.unauthenticated;
  }
  if (result.code === "invalid_payload") {
    return copy.invalidPayload;
  }
  if (result.code === "conflict") {
    return copy.conflict;
  }
  return copy.genericError;
}

export function OffersAdminPanel({
  venueId,
  timezone,
  moduleState,
  approvalRequired,
  capabilities,
  publicOffersHref = null,
  offer,
}: OffersAdminPanelProps): React.ReactElement {
  const t = useTranslations("offersAdmin");
  const tStatus = useTranslations("status");
  const router = useRouter();
  const [titleEn, setTitleEn] = useState(offer?.titleEn ?? "");
  const [descriptionEn, setDescriptionEn] = useState(
    offer?.descriptionEn ?? "",
  );
  const [termsEn, setTermsEn] = useState(offer?.termsEn ?? "");
  const [titleTh, setTitleTh] = useState(offer?.titleTh ?? "");
  const [descriptionTh, setDescriptionTh] = useState(
    offer?.descriptionTh ?? "",
  );
  const [termsTh, setTermsTh] = useState(offer?.termsTh ?? "");
  const [validFromLocal, setValidFromLocal] = useState(
    offer?.validFromLocal ?? "",
  );
  const [validUntilLocal, setValidUntilLocal] = useState(
    offer?.validUntilLocal ?? "",
  );
  const [scheduledForLocal, setScheduledForLocal] = useState(
    offer?.scheduledForLocal ?? "",
  );
  const [rejectReason, setRejectReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const isNew = offer === null || offer === undefined || offer.id === null;
  const state = offer?.state ?? "draft";
  const locked =
    state === "published" || state === "scheduled" || state === "archived";

  const noticeCopy = {
    saved: t("saved"),
    forbidden: t("forbidden"),
    unauthenticated: t("unauthenticated"),
    invalidPayload: t("invalidPayload"),
    conflict: t("conflict"),
    genericError: t("genericError"),
  };

  function run(task: () => Promise<OfferActionResult>): void {
    startTransition(() => {
      void task().then((result) => {
        setNotice(noticeFor(result, noticeCopy));
        if (result.ok) {
          router.refresh();
        }
      });
    });
  }

  const payload = {
    titleEn,
    descriptionEn,
    termsEn,
    titleTh: titleTh.length > 0 ? titleTh : undefined,
    descriptionTh: descriptionTh.length > 0 ? descriptionTh : undefined,
    termsTh: termsTh.length > 0 ? termsTh : undefined,
    validFromLocal,
    validUntilLocal,
  };

  const validityKey = offerValidityLabel(
    offer?.validFrom ?? new Date().toISOString(),
    offer?.validUntil ?? new Date().toISOString(),
  );

  return (
    <form
      className="space-y-4"
      data-testid="offers-admin-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (isNew) {
          startTransition(() => {
            void createOfferAction({ venueId, ...payload }).then((result) => {
              if (result.ok && result.data?.offerId) {
                router.push(`/admin/offers/${result.data.offerId}`);
                return;
              }
              setNotice(noticeFor(result, noticeCopy));
            });
          });
          return;
        }
        run(() =>
          updateOfferDraftAction({ offerId: offer.id as string, ...payload }),
        );
      }}
    >
      {notice !== null ? (
        <p className="text-sm" role="status">
          {notice}
        </p>
      ) : null}

      {!isNew ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            variant={offerStateBadgeVariant(state)}
            label={tStatus(offerStateCopyKey(state))}
          />
          <StatusBadge
            variant="secondary"
            label={
              validityKey === "upcoming"
                ? t("validityUpcoming")
                : validityKey === "active"
                  ? t("validityActive")
                  : t("validityExpired")
            }
          />
          {offer?.quarantined ? (
            <StatusBadge variant="secondary" label={t("quarantined")} />
          ) : null}
        </div>
      ) : null}

      {offer?.rejectionReason !== null &&
      offer?.rejectionReason !== undefined ? (
        <p className="text-sm text-muted-foreground">{t("rejectedPrivate")}</p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {t("timezoneHelp", { timezone })}
      </p>

      <div className="space-y-2">
        <Label htmlFor="title-en">{t("titleEn")}</Label>
        <Input
          id="title-en"
          value={titleEn}
          maxLength={120}
          disabled={locked}
          onChange={(event) => {
            setTitleEn(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description-en">{t("descriptionEn")}</Label>
        <textarea
          id="description-en"
          value={descriptionEn}
          maxLength={2000}
          disabled={locked}
          className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
          onChange={(event) => {
            setDescriptionEn(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-en">{t("termsEn")}</Label>
        <textarea
          id="terms-en"
          value={termsEn}
          maxLength={4000}
          disabled={locked}
          className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
          onChange={(event) => {
            setTermsEn(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="title-th">{t("titleTh")}</Label>
        <Input
          id="title-th"
          value={titleTh}
          maxLength={120}
          disabled={locked}
          onChange={(event) => {
            setTitleTh(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description-th">{t("descriptionTh")}</Label>
        <textarea
          id="description-th"
          value={descriptionTh}
          maxLength={2000}
          disabled={locked}
          className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
          onChange={(event) => {
            setDescriptionTh(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-th">{t("termsTh")}</Label>
        <textarea
          id="terms-th"
          value={termsTh}
          maxLength={4000}
          disabled={locked}
          className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
          onChange={(event) => {
            setTermsTh(event.target.value);
          }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="valid-from">{t("validFrom")}</Label>
          <Input
            id="valid-from"
            type="datetime-local"
            value={validFromLocal}
            disabled={locked}
            onChange={(event) => {
              setValidFromLocal(event.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valid-until">{t("validUntil")}</Label>
          <Input
            id="valid-until"
            type="datetime-local"
            value={validUntilLocal}
            disabled={locked}
            onChange={(event) => {
              setValidUntilLocal(event.target.value);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("validitySemantics")}</p>

      <div className="rounded-lg border border-border p-3">
        <p className="text-sm font-medium">{t("preview")}</p>
        {isNew || state === "draft" || state === "pending_approval" ? (
          <p className="mt-1 text-xs font-medium">{t("draftPreview")}</p>
        ) : null}
        <p className="mt-1 font-semibold">{titleEn || t("previewEmpty")}</p>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {descriptionEn}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {(capabilities.canCreate || capabilities.canEdit) &&
        state === "draft" ? (
          <Button type="submit" className="min-h-11">
            {isNew ? t("createDraft") : t("saveDraft")}
          </Button>
        ) : null}
        {capabilities.canSubmit && !isNew && state === "draft" ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              run(() => submitOfferAction(offer.id as string));
            }}
          >
            {t("submit")}
          </Button>
        ) : null}
        {capabilities.canApprove &&
        state === "pending_approval" &&
        offer?.id ? (
          <>
            <Button
              type="button"
              className="min-h-11"
              onClick={() => {
                run(() => approveOfferAction(offer.id as string));
              }}
            >
              {t("approve")}
            </Button>
            <Input
              value={rejectReason}
              placeholder={t("rejectReason")}
              onChange={(event) => {
                setRejectReason(event.target.value);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                run(() =>
                  rejectOfferAction({
                    offerId: offer.id as string,
                    reason: rejectReason,
                  }),
                );
              }}
            >
              {t("reject")}
            </Button>
          </>
        ) : null}
        {capabilities.canPublish &&
        !isNew &&
        (state === "draft" || state === "scheduled") &&
        (!approvalRequired || offer?.approvedAt !== null) ? (
          <Button
            type="button"
            className="min-h-11"
            onClick={() => {
              run(() => publishOfferNowAction(offer.id as string));
            }}
          >
            {t("publishNow")}
          </Button>
        ) : null}
        {state === "published" && publicOffersHref !== null ? (
          <Button asChild variant="secondary" className="min-h-11">
            <Link href={publicOffersHref}>{t("viewPublic")}</Link>
          </Button>
        ) : null}
        {capabilities.canPublish &&
        !isNew &&
        state === "draft" &&
        (!approvalRequired || offer?.approvedAt !== null) ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
            <div className="w-full space-y-2">
              <Label htmlFor="offer-scheduled">{t("schedule")}</Label>
              <Input
                id="offer-scheduled"
                type="datetime-local"
                value={scheduledForLocal}
                onChange={(event) => {
                  setScheduledForLocal(event.target.value);
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                const local = parseVenueLocalDateTime(scheduledForLocal);
                const utc =
                  local === null
                    ? null
                    : venueLocalDateTimeToUtc(local, timezone);
                if (utc === null) {
                  setNotice(noticeCopy.invalidPayload);
                  return;
                }
                run(() =>
                  scheduleOfferAction({
                    offerId: offer.id as string,
                    scheduledFor: utc.toISOString(),
                  }),
                );
              }}
            >
              {t("schedule")}
            </Button>
          </div>
        ) : null}
        {capabilities.canPublish &&
        !isNew &&
        (state === "published" || state === "scheduled") ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              if (window.confirm(t("confirmUnpublish"))) {
                run(() => unpublishOfferAction(offer.id as string));
              }
            }}
          >
            {t("unpublish")}
          </Button>
        ) : null}
        {capabilities.canPublish && !isNew && state !== "archived" ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              if (window.confirm(t("confirmArchive"))) {
                run(() => archiveOfferAction(offer.id as string));
              }
            }}
          >
            {t("archive")}
          </Button>
        ) : null}
        {capabilities.canPublish && state === "archived" && offer?.id ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              run(() => restoreOfferAction(offer.id as string));
            }}
          >
            {t("restore")}
          </Button>
        ) : null}
      </div>

      {offer?.history && offer.history.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">{t("historyTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("historyHelp")}</p>
          <ul className="space-y-1 text-sm">
            {offer.history.map((row) => (
              <li key={`${row.createdAt}-${row.action}`}>
                {row.action}
                {row.fromState !== null && row.toState !== null
                  ? ` (${row.fromState} → ${row.toState})`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {moduleState !== "enabled" && moduleState !== "trial" ? (
        <p className="text-sm text-muted-foreground">{t("moduleLimited")}</p>
      ) : null}
    </form>
  );
}
