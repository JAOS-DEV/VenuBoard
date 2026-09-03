"use client";

import { useState, useTransition } from "react";
import type { ReactElement } from "react";

import { ConfirmationDialog } from "@/components/patterns/confirmation-dialog";
import { StatusBadge } from "@/components/patterns/status-badge";
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
import {
  clearAtmosphereAction,
  setAtmosphereAction,
  updateAtmosphereSettingsAction,
} from "@/core/atmosphere/actions";
import {
  ATMOSPHERE_EXPIRY_MINUTES,
  ATMOSPHERE_STATES,
  remainingMinutes,
  type AtmosphereExpiryMinutes,
  type AtmosphereState,
} from "@/core/atmosphere/constants";
import type { AdminAtmosphereData } from "@/core/atmosphere/directory";
import { atmosphereCopyKey } from "@/core/atmosphere/labels";
import type { AtmosphereActionCode } from "@/core/atmosphere/result";

interface AtmosphereAdminPanelProps {
  venueId: string;
  data: AdminAtmosphereData;
  canWrite: boolean;
  canConfigure: boolean;
  writesBlocked: boolean;
  labels: Record<string, string>;
}

function messageFor(
  labels: Record<string, string>,
  code: AtmosphereActionCode | "ok",
): string {
  if (code === "ok") {
    return labels.saved ?? "";
  }
  return labels[code] ?? labels.unavailable ?? "";
}

function statusLabel(
  state: AtmosphereState | null,
  labels: Record<string, string>,
): string {
  return labels[atmosphereCopyKey(state)] ?? labels.none ?? "";
}

function actionLabel(action: string, labels: Record<string, string>): string {
  if (action === "replace") {
    return labels.historyReplace ?? action;
  }
  if (action === "clear") {
    return labels.historyClear ?? action;
  }
  return labels.historySet ?? action;
}

export function AtmosphereAdminPanel({
  venueId,
  data,
  canWrite,
  canConfigure,
  writesBlocked,
  labels,
}: AtmosphereAdminPanelProps): ReactElement {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiryMinutes, setExpiryMinutes] = useState<AtmosphereExpiryMinutes>(
    data.settings.defaultExpiryMinutes,
  );

  const writable =
    canWrite && !writesBlocked && data.moduleState !== "entitled_disabled";

  function report(
    result: { ok: true } | { ok: false; code: AtmosphereActionCode },
  ): void {
    if (result.ok) {
      setError(null);
      setMessage(messageFor(labels, "ok"));
      return;
    }
    setMessage(null);
    setError(messageFor(labels, result.code));
  }

  function setState(state: AtmosphereState): void {
    startTransition(async () => {
      report(
        await setAtmosphereAction({
          venueId,
          state,
          expiryMinutes,
        }),
      );
    });
  }

  function clearState(): void {
    startTransition(async () => {
      report(await clearAtmosphereAction({ venueId }));
    });
  }

  const remaining =
    data.currentIsLive && data.current !== null
      ? remainingMinutes(data.current.expiresAt)
      : 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{labels.currentTitle}</CardTitle>
          <CardDescription>{labels.promotionalHelp}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.currentIsLive && data.current !== null ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">
                {statusLabel(data.current.state, labels)}
              </p>
              <StatusBadge
                label={statusLabel(data.current.state, labels)}
                variant="published"
              />
              <p className="w-full text-sm text-muted-foreground">
                {labels.remainingPrefix} {String(remaining)}{" "}
                {labels.remainingSuffix}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{labels.none}</p>
          )}

          {writable ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="atmosphere-expiry">{labels.expiry}</Label>
                <select
                  id="atmosphere-expiry"
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                  value={expiryMinutes}
                  onChange={(event) => {
                    setExpiryMinutes(
                      Number(event.target.value) as AtmosphereExpiryMinutes,
                    );
                  }}
                >
                  {ATMOSPHERE_EXPIRY_MINUTES.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {labels[`expiry${String(minutes)}`] ??
                        `${String(minutes)} min`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ATMOSPHERE_STATES.map((state) => {
                  const selected =
                    data.currentIsLive && data.current?.state === state;
                  return (
                    <Button
                      key={state}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      aria-pressed={selected}
                      disabled={pending}
                      onClick={() => {
                        setState(state);
                      }}
                    >
                      {statusLabel(state, labels)}
                    </Button>
                  );
                })}
              </div>
              <ConfirmationDialog
                trigger={
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending}
                  >
                    {labels.clear}
                  </Button>
                }
                title={labels.clearConfirmTitle ?? ""}
                description={labels.clearConfirmBody ?? ""}
                confirmLabel={labels.clearConfirm ?? ""}
                cancelLabel={labels.cancel ?? ""}
                destructive
                onConfirm={clearState}
              />
            </>
          ) : writesBlocked ? (
            <p className="text-sm text-muted-foreground">{labels.readOnly}</p>
          ) : null}

          {message !== null ? (
            <p role="status" className="text-sm">
              {message}
            </p>
          ) : null}
          {error !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canConfigure ? (
        <Card>
          <CardHeader>
            <CardTitle>{labels.moduleSettings}</CardTitle>
            <CardDescription>{labels.moduleSettingsHelp}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              action={(formData) => {
                startTransition(async () => {
                  report(
                    await updateAtmosphereSettingsAction({
                      venueId,
                      isEnabled: formData.get("isEnabled") === "on",
                      isPubliclyVisible:
                        formData.get("isPubliclyVisible") === "on",
                      defaultExpiryMinutes: Number(
                        formData.get("defaultExpiryMinutes"),
                      ),
                      frontOfHouseMayUpdate:
                        formData.get("frontOfHouseMayUpdate") === "on",
                      presentation: formData.get("presentation"),
                      headingEn: String(formData.get("headingEn") ?? ""),
                      headingTh: String(formData.get("headingTh") ?? ""),
                    }),
                  );
                });
              }}
            >
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="isEnabled"
                  defaultChecked={data.settings.isEnabled}
                  className="size-5"
                />
                {labels.enabled}
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="isPubliclyVisible"
                  defaultChecked={data.settings.isPubliclyVisible}
                  className="size-5"
                />
                {labels.publiclyVisible}
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="frontOfHouseMayUpdate"
                  defaultChecked={data.settings.frontOfHouseMayUpdate}
                  className="size-5"
                />
                {labels.frontOfHouse}
              </label>
              <div className="space-y-1">
                <Label htmlFor="default-expiry">{labels.defaultExpiry}</Label>
                <select
                  id="default-expiry"
                  name="defaultExpiryMinutes"
                  defaultValue={data.settings.defaultExpiryMinutes}
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                >
                  {ATMOSPHERE_EXPIRY_MINUTES.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {labels[`expiry${String(minutes)}`] ??
                        `${String(minutes)} min`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="presentation">{labels.presentation}</Label>
                <select
                  id="presentation"
                  name="presentation"
                  defaultValue={data.settings.presentation}
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="card">{labels.presentationCard}</option>
                  <option value="compact">{labels.presentationCompact}</option>
                  <option value="badge">{labels.presentationBadge}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="heading-en">{labels.headingEn}</Label>
                <Input
                  id="heading-en"
                  name="headingEn"
                  defaultValue={data.settings.headingEn}
                  maxLength={80}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="heading-th">{labels.headingTh}</Label>
                <Input
                  id="heading-th"
                  name="headingTh"
                  defaultValue={data.settings.headingTh}
                  maxLength={80}
                />
              </div>
              <Button type="submit" disabled={pending || writesBlocked}>
                {labels.saveSettings}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {data.history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{labels.historyTitle}</CardTitle>
            <CardDescription>{labels.historyHelp}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {data.history.map((row) => (
                <li key={row.id} className="text-sm">
                  <p className="font-medium">
                    {actionLabel(row.action, labels)}
                  </p>
                  <p className="text-muted-foreground">
                    {statusLabel(row.previousState, labels)}
                    {" → "}
                    {statusLabel(row.newState, labels)}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
