"use client";

import { startTransition, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Link, useRouter } from "@/core/i18n/navigation";
import {
  approveFeedPostAction,
  archiveFeedPostAction,
  copyFeedPostAction,
  createFeedPostAction,
  pinFeedPostAction,
  publishFeedPostNowAction,
  rejectFeedPostAction,
  restoreFeedPostAction,
  scheduleFeedPostAction,
  submitFeedPostAction,
  unpinFeedPostAction,
  unpublishFeedPostAction,
  updateFeedPostDraftAction,
} from "@/core/feed/actions";
import {
  feedStateBadgeVariant,
  feedStateCopyKey,
  feedTypeCopyKey,
} from "@/core/feed/labels";
import type { FeedActionResult } from "@/core/feed/result";
import type { FeedPostType } from "@/core/feed/constants";

interface FeedCapabilities {
  canCreate: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canCopyToVenues: boolean;
}

interface FeedFormState {
  id: string | null;
  postType: FeedPostType;
  titleEn: string;
  bodyEn: string;
  titleTh: string;
  bodyTh: string;
  state: string;
  isPinned: boolean;
  scheduledFor: string;
  rejectionReason: string | null;
  approvedAt: string | null;
}

export interface FeedAdminPanelProps {
  venueId: string;
  moduleState: string;
  approvalRequired: boolean;
  capabilities: FeedCapabilities;
  availableCopyDestinations: Array<{ id: string; name: string }>;
  publicUpdatesHref?: string | null;
  post?: FeedFormState | null;
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

export function FeedAdminPanel({
  venueId,
  moduleState,
  approvalRequired,
  capabilities,
  availableCopyDestinations,
  publicUpdatesHref = null,
  post,
}: FeedAdminPanelProps): React.ReactElement {
  const t = useTranslations("feedAdmin");
  const tStatus = useTranslations("status");
  const router = useRouter();
  const [titleEn, setTitleEn] = useState(post?.titleEn ?? "");
  const [bodyEn, setBodyEn] = useState(post?.bodyEn ?? "");
  const [titleTh, setTitleTh] = useState(post?.titleTh ?? "");
  const [bodyTh, setBodyTh] = useState(post?.bodyTh ?? "");
  const [postType, setPostType] = useState<FeedPostType>(
    post?.postType ?? "update",
  );
  const [scheduledFor, setScheduledFor] = useState(post?.scheduledFor ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [copyDest, setCopyDest] = useState(
    availableCopyDestinations[0]?.id ?? "",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const isNew = post === null || post === undefined || post.id === null;
  const state = post?.state ?? "draft";

  const noticeCopy = {
    saved: t("saved"),
    forbidden: t("forbidden"),
    unauthenticated: t("unauthenticated"),
    invalidPayload: t("invalidPayload"),
    conflict: t("conflict"),
    genericError: t("genericError"),
  };

  function run(task: () => Promise<FeedActionResult>): void {
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
    postType,
    titleEn,
    bodyEn,
    titleTh: titleTh.length > 0 ? titleTh : undefined,
    bodyTh: bodyTh.length > 0 ? bodyTh : undefined,
  };

  return (
    <form
      className="space-y-4"
      data-testid="feed-admin-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (isNew) {
          startTransition(() => {
            void createFeedPostAction({ venueId, ...payload }).then(
              (result) => {
                if (result.ok && result.data?.postId) {
                  router.push(`/admin/feed/${result.data.postId}`);
                  return;
                }
                setNotice(noticeFor(result, noticeCopy));
              },
            );
          });
          return;
        }
        run(() =>
          updateFeedPostDraftAction({ postId: post.id as string, ...payload }),
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
            variant={feedStateBadgeVariant(state)}
            label={tStatus(feedStateCopyKey(state))}
          />
          <span className="text-sm text-muted-foreground">
            {t(feedTypeCopyKey(postType))}
          </span>
          {post?.isPinned ? (
            <span className="text-sm font-medium">{t("pinned")}</span>
          ) : null}
        </div>
      ) : null}

      {post?.rejectionReason !== null && post?.rejectionReason !== undefined ? (
        <p className="text-sm text-muted-foreground">{t("rejectedPrivate")}</p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="feed-type">{t("postType")}</Label>
        <select
          id="feed-type"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3"
          value={postType}
          onChange={(event) => {
            setPostType(event.target.value as FeedPostType);
          }}
          disabled={!capabilities.canEdit && !isNew}
        >
          <option value="update">{t("typeUpdate")}</option>
          <option value="announcement">{t("typeAnnouncement")}</option>
          <option value="notice">{t("typeNotice")}</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title-en">{t("titleEn")}</Label>
        <Input
          id="title-en"
          value={titleEn}
          maxLength={120}
          onChange={(event) => {
            setTitleEn(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body-en">{t("bodyEn")}</Label>
        <textarea
          id="body-en"
          value={bodyEn}
          maxLength={2000}
          className="min-h-32 w-full rounded-md border border-input bg-background p-3 text-sm"
          onChange={(event) => {
            setBodyEn(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="title-th">{t("titleTh")}</Label>
        <Input
          id="title-th"
          value={titleTh}
          maxLength={120}
          onChange={(event) => {
            setTitleTh(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body-th">{t("bodyTh")}</Label>
        <textarea
          id="body-th"
          value={bodyTh}
          maxLength={2000}
          className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
          onChange={(event) => {
            setBodyTh(event.target.value);
          }}
        />
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="text-sm font-medium">{t("preview")}</p>
        <p className="mt-1 font-semibold">{titleEn || t("previewEmpty")}</p>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {bodyEn}
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
              run(() => submitFeedPostAction(post.id as string));
            }}
          >
            {t("submit")}
          </Button>
        ) : null}
        {capabilities.canApprove && state === "pending_approval" && post?.id ? (
          <>
            <Button
              type="button"
              className="min-h-11"
              onClick={() => {
                run(() => approveFeedPostAction(post.id as string));
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
                  rejectFeedPostAction({
                    postId: post.id as string,
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
        (!approvalRequired || post?.approvedAt !== null) ? (
          <Button
            type="button"
            className="min-h-11"
            onClick={() => {
              run(() => publishFeedPostNowAction(post.id as string));
            }}
          >
            {t("publishNow")}
          </Button>
        ) : null}
        {state === "published" && publicUpdatesHref !== null ? (
          <Button asChild variant="secondary" className="min-h-11">
            <Link href={publicUpdatesHref}>{t("viewPublic")}</Link>
          </Button>
        ) : null}
        {capabilities.canPublish &&
        !isNew &&
        state === "draft" &&
        (!approvalRequired || post?.approvedAt !== null) ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
            <div className="w-full space-y-2">
              <Label htmlFor="feed-scheduled">{t("schedule")}</Label>
              <Input
                id="feed-scheduled"
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => {
                  setScheduledFor(event.target.value);
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                const iso =
                  scheduledFor.length > 0
                    ? new Date(scheduledFor).toISOString()
                    : "";
                run(() =>
                  scheduleFeedPostAction({
                    postId: post.id as string,
                    scheduledFor: iso,
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
                run(() => unpublishFeedPostAction(post.id as string));
              }
            }}
          >
            {t("unpublish")}
          </Button>
        ) : null}
        {capabilities.canPublish && !isNew && state === "published" ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              run(() =>
                post.isPinned
                  ? unpinFeedPostAction(post.id as string)
                  : pinFeedPostAction(post.id as string),
              );
            }}
          >
            {post?.isPinned ? t("unpin") : t("pin")}
          </Button>
        ) : null}
        {capabilities.canPublish && !isNew && state !== "archived" ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              if (window.confirm(t("confirmArchive"))) {
                run(() => archiveFeedPostAction(post.id as string));
              }
            }}
          >
            {t("archive")}
          </Button>
        ) : null}
        {capabilities.canPublish && state === "archived" && post?.id ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              run(() => restoreFeedPostAction(post.id as string));
            }}
          >
            {t("restore")}
          </Button>
        ) : null}
      </div>

      {capabilities.canCopyToVenues && !isNew && post?.id ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full space-y-2">
            <Label htmlFor="copy-dest">{t("copyDestination")}</Label>
            <select
              id="copy-dest"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3"
              value={copyDest}
              onChange={(event) => {
                setCopyDest(event.target.value);
              }}
            >
              {availableCopyDestinations.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={copyDest.length === 0}
            onClick={() => {
              run(async () => {
                const result = await copyFeedPostAction({
                  postId: post.id as string,
                  destVenueId: copyDest,
                });
                return result.ok ? { ok: true } : result;
              });
            }}
          >
            {t("copyToVenue")}
          </Button>
        </div>
      ) : null}

      {moduleState !== "enabled" && moduleState !== "trial" ? (
        <p className="text-sm text-muted-foreground">{t("moduleLimited")}</p>
      ) : null}
    </form>
  );
}
