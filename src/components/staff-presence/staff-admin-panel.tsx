"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
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
  assignStaffToVenueAction,
  bulkMarkStaffNotPresentAction,
  createStaffMemberAction,
  deactivateStaffAction,
  restoreStaffAction,
  saveStaffModuleSettingsAction,
  setStaffConsentAction,
  setStaffPresenceAction,
  updateStaffProfileAction,
} from "@/core/staff-presence/actions";
import {
  actorOwnsConsentedProfile,
  actorOwnsStaffProfile,
  type StaffAdminCapabilities,
} from "@/core/staff-presence/ownership";
import type { StaffDirectoryData } from "@/core/staff-presence/directory";

interface StaffAdminPanelProps {
  capabilities: StaffAdminCapabilities;
  venueId: string;
  directory: StaffDirectoryData;
  labels: Record<string, string>;
}

function labelText(labels: Record<string, string>, key: string): string {
  return labels[key] ?? key;
}

function messageFor(
  labels: Record<string, string>,
  code: string | undefined,
): string {
  if (code === undefined) {
    return labelText(labels, "saved");
  }
  return labels[code] ?? labelText(labels, "genericError");
}

export function StaffAdminPanel({
  capabilities,
  venueId,
  directory,
  labels,
}: StaffAdminPanelProps): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = capabilities.canManageProfiles;
  const canToggle = capabilities.canToggleAnyPresence;
  const canConfigure = capabilities.canConfigureModule;

  function run(task: () => Promise<{ ok: boolean; code?: string }>): void {
    startTransition(() => {
      void task().then((result) => {
        setNotice(messageFor(labels, result.ok ? undefined : result.code));
      });
    });
  }

  return (
    <div className="space-y-8">
      {notice !== null ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{labels.moduleSettings}</CardTitle>
          <CardDescription>{labels.moduleSettingsHelp}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>
            <Badge variant="outline">
              {labels[`state_${directory.moduleState}`]}
            </Badge>
          </p>
          {canConfigure ? (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                run(() =>
                  saveStaffModuleSettingsAction({
                    venueId,
                    isEnabled: form.get("isEnabled") === "on",
                    isPubliclyVisible: form.get("isPubliclyVisible") === "on",
                    displayMode: form.get("displayMode"),
                    carouselOrder: form.get("carouselOrder"),
                    presenceExpiryHours: form.get("presenceExpiryHours"),
                    carouselAutoAdvance:
                      form.get("carouselAutoAdvance") === "on",
                    headingEn: form.get("headingEn"),
                    headingTh: form.get("headingTh"),
                  }),
                );
              }}
            >
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isEnabled"
                  defaultChecked={directory.enabled}
                />
                {labels.enabled}
              </Label>
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isPubliclyVisible"
                  defaultChecked={directory.publiclyVisible}
                />
                {labels.publiclyVisible}
              </Label>
              <div className="space-y-1">
                <Label htmlFor="displayMode">{labels.displayMode}</Label>
                <select
                  id="displayMode"
                  name="displayMode"
                  defaultValue={directory.settings.displayMode}
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="all_published">{labels.showAll}</option>
                  <option value="present_only">{labels.showPresentOnly}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="carouselOrder">{labels.carouselOrder}</Label>
                <select
                  id="carouselOrder"
                  name="carouselOrder"
                  defaultValue={directory.settings.carouselOrder}
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="display_order">{labels.orderDisplay}</option>
                  <option value="name">{labels.orderName}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="presenceExpiryHours">
                  {labels.expiryHours}
                </Label>
                <Input
                  id="presenceExpiryHours"
                  name="presenceExpiryHours"
                  type="number"
                  min={1}
                  max={24}
                  defaultValue={directory.settings.presenceExpiryHours}
                />
              </div>
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="carouselAutoAdvance"
                  defaultChecked={directory.settings.carouselAutoAdvance}
                />
                {labels.autoAdvance}
              </Label>
              <div className="space-y-1">
                <Label htmlFor="headingEn">{labels.headingEn}</Label>
                <Input
                  id="headingEn"
                  name="headingEn"
                  defaultValue={directory.headingEn ?? ""}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="headingTh">{labels.headingTh}</Label>
                <Input
                  id="headingTh"
                  name="headingTh"
                  defaultValue={directory.headingTh ?? ""}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {labels.saveSettings}
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{labels.addStaff}</CardTitle>
            <CardDescription>{labels.privatePublicSplit}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                run(() =>
                  createStaffMemberAction({
                    venueId,
                    internalDisplayName: form.get("internalDisplayName"),
                    publicDisplayName: form.get("publicDisplayName"),
                    publicTitle: form.get("publicTitle"),
                    bioEn: form.get("bioEn"),
                    bioTh: form.get("bioTh"),
                    displayOrder: form.get("displayOrder"),
                    publicationState: "draft",
                    consentState: "pending",
                  }),
                );
                event.currentTarget.reset();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="internalDisplayName">
                  {labels.internalName}
                </Label>
                <Input
                  id="internalDisplayName"
                  name="internalDisplayName"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {labels.internalHint}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="publicDisplayName">{labels.publicName}</Label>
                <Input
                  id="publicDisplayName"
                  name="publicDisplayName"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="publicTitle">{labels.publicTitle}</Label>
                <Input id="publicTitle" name="publicTitle" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="displayOrder">{labels.displayOrder}</Label>
                <Input
                  id="displayOrder"
                  name="displayOrder"
                  type="number"
                  min={0}
                  defaultValue={0}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bioEn">{labels.bioEn}</Label>
                <Input id="bioEn" name="bioEn" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bioTh">{labels.bioTh}</Label>
                <Input id="bioTh" name="bioTh" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {labels.addStaff}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canManage &&
      directory.assignableMembers.some((row) => !row.alreadyAssigned) ? (
        <Card>
          <CardHeader>
            <CardTitle>{labels.assignExisting}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                run(() =>
                  assignStaffToVenueAction({
                    venueId,
                    staffMemberId: form.get("staffMemberId"),
                    publicDisplayName: form.get("assignPublicName"),
                  }),
                );
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="staffMemberId">{labels.businessStaff}</Label>
                <select
                  id="staffMemberId"
                  name="staffMemberId"
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                  required
                >
                  {directory.assignableMembers
                    .filter((row) => !row.alreadyAssigned)
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.internalDisplayName}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="assignPublicName">{labels.publicName}</Label>
                <Input id="assignPublicName" name="assignPublicName" required />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {labels.assignExisting}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canToggle ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            if (form.get("confirmBulk") !== "on") {
              setNotice(labelText(labels, "confirmRequired"));
              return;
            }
            run(() => bulkMarkStaffNotPresentAction(venueId));
          }}
        >
          <Label className="mb-3 flex items-center gap-2">
            <input type="checkbox" name="confirmBulk" />
            {labels.confirmBulk}
          </Label>
          <Button type="submit" variant="secondary" disabled={pending}>
            {labels.bulkNotPresent}
          </Button>
        </form>
      ) : null}

      <ul className="space-y-4">
        {directory.rows.map((row) => {
          const ownLinked = actorOwnsStaffProfile(
            capabilities.userId,
            row.linkedUserId,
          );
          const own = actorOwnsConsentedProfile(capabilities.userId, row);
          const showToggle = canToggle || own;
          const showConsent =
            canManage || (ownLinked && capabilities.canManageOwnConsent);
          const showProfileForm =
            canManage || (ownLinked && capabilities.canEditOwnProfile);

          return (
            <li key={row.profileId}>
              <Card>
                <CardHeader>
                  <CardTitle>{row.publicDisplayName}</CardTitle>
                  <CardDescription>
                    {row.internalDisplayName !== null
                      ? `${labels.internalName}: ${row.internalDisplayName}`
                      : labels.publicOnly}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{row.consentState}</Badge>
                    <Badge variant="outline">{row.publicationState}</Badge>
                    <Badge variant="outline">{row.presenceState}</Badge>
                    <Badge variant="outline">{row.staffStatus}</Badge>
                  </div>

                  {showProfileForm ? (
                    <form
                      className="grid gap-3 sm:grid-cols-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        run(() =>
                          updateStaffProfileAction({
                            profileId: row.profileId,
                            publicDisplayName: form.get("publicDisplayName"),
                            publicTitle: form.get("publicTitle"),
                            bioEn: form.get("bioEn"),
                            bioTh: form.get("bioTh"),
                            displayOrder: form.get("displayOrder"),
                            publicationState: canManage
                              ? form.get("publicationState")
                              : undefined,
                          }),
                        );
                      }}
                    >
                      <div className="space-y-1">
                        <Label>{labels.publicName}</Label>
                        <Input
                          name="publicDisplayName"
                          defaultValue={row.publicDisplayName}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{labels.publicTitle}</Label>
                        <Input
                          name="publicTitle"
                          defaultValue={row.publicTitle ?? ""}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{labels.bioEn}</Label>
                        <Input name="bioEn" defaultValue={row.bioEn ?? ""} />
                      </div>
                      <div className="space-y-1">
                        <Label>{labels.bioTh}</Label>
                        <Input name="bioTh" defaultValue={row.bioTh ?? ""} />
                      </div>
                      {canManage ? (
                        <>
                          <div className="space-y-1">
                            <Label>{labels.displayOrder}</Label>
                            <Input
                              name="displayOrder"
                              type="number"
                              min={0}
                              defaultValue={row.displayOrder}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>{labels.publication}</Label>
                            <select
                              name="publicationState"
                              defaultValue={row.publicationState}
                              className="h-11 w-full rounded-md border border-input bg-background px-3"
                            >
                              <option value="draft">{labels.draft}</option>
                              <option value="published">
                                {labels.published}
                              </option>
                            </select>
                          </div>
                        </>
                      ) : null}
                      <div className="sm:col-span-2">
                        <Button type="submit" disabled={pending}>
                          {labels.saveProfile}
                        </Button>
                      </div>
                    </form>
                  ) : null}

                  {showConsent ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          run(() =>
                            setStaffConsentAction({
                              profileId: row.profileId,
                              consentState: "granted",
                            }),
                          );
                        }}
                      >
                        {labels.grantConsent}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          run(() =>
                            setStaffConsentAction({
                              profileId: row.profileId,
                              consentState: "withdrawn",
                            }),
                          );
                        }}
                      >
                        {labels.withdrawConsent}
                      </Button>
                    </div>
                  ) : null}

                  {showToggle && row.staffStatus === "active" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          run(() =>
                            setStaffPresenceAction({
                              profileId: row.profileId,
                              state: "present",
                            }),
                          );
                        }}
                      >
                        {labels.markPresent}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          run(() =>
                            setStaffPresenceAction({
                              profileId: row.profileId,
                              state: "not_present",
                            }),
                          );
                        }}
                      >
                        {labels.markNotPresent}
                      </Button>
                    </div>
                  ) : null}

                  {canManage ? (
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        if (form.get("confirmState") !== "on") {
                          setNotice(labelText(labels, "confirmRequired"));
                          return;
                        }
                        if (row.staffStatus === "deactivated") {
                          run(() => restoreStaffAction(row.staffMemberId));
                        } else {
                          run(() => deactivateStaffAction(row.staffMemberId));
                        }
                      }}
                    >
                      <Label className="flex items-center gap-2">
                        <input type="checkbox" name="confirmState" />
                        {row.staffStatus === "deactivated"
                          ? labels.confirmRestore
                          : labels.confirmDeactivate}
                      </Label>
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={pending}
                      >
                        {row.staffStatus === "deactivated"
                          ? labels.restore
                          : labels.deactivate}
                      </Button>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
