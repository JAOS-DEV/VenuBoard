"use client";

import { startTransition, useState } from "react";
import { useTranslations } from "next-intl";

import { ConfirmationDialog } from "@/components/patterns/confirmation-dialog";
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
import { Link } from "@/core/i18n/navigation";
import { publicVenueHomePath } from "@/core/public-venue/paths";
import {
  saveVenueBrandingAction,
  saveVenueOpeningHoursAction,
  saveVenuePublicProfileAction,
  setVenuePublicationAction,
} from "@/core/venue-profile/actions";
import {
  ISO_WEEKDAYS,
  VENUE_HOURS_MAX_INTERVALS,
} from "@/core/venue-profile/constants";
import { isoWeekdayMessageKey } from "@/core/venue-profile/labels";
import type { AdminVenueProfile } from "@/core/venue-profile/public-types";

interface VenueProfileEditorProps {
  profile: AdminVenueProfile;
  canManageVenue: boolean;
  canManageBranding: boolean;
}

function noticeFor(
  result: { ok: boolean; code?: string; errors?: string[] },
  saved: string,
  fallback: string,
): string {
  if (result.ok) {
    return saved;
  }
  if (result.errors !== undefined && result.errors.length > 0) {
    return result.errors.join(", ");
  }
  return fallback;
}

export function VenueProfileEditor({
  profile,
  canManageVenue,
  canManageBranding,
}: VenueProfileEditorProps): React.ReactElement {
  const t = useTranslations("venueProfileAdmin");
  const [notice, setNotice] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(profile.updatedAt);
  const readOnly = !canManageVenue;

  return (
    <div
      className="space-y-5"
      data-testid="venue-profile-admin"
      data-venue-id={profile.venueId}
    >
      {notice !== null ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("publicInformation")}</CardTitle>
          <CardDescription>{t("publicInformationHelp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (readOnly) {
                return;
              }
              const form = new FormData(event.currentTarget);
              const latRaw = String(form.get("latitude") ?? "").trim();
              const lngRaw = String(form.get("longitude") ?? "").trim();
              startTransition(() => {
                void saveVenuePublicProfileAction({
                  venueId: profile.venueId,
                  expectedUpdatedAt: updatedAt,
                  name: String(form.get("name") ?? ""),
                  nameEn: String(form.get("nameEn") ?? ""),
                  taglineEn: String(form.get("taglineEn") ?? ""),
                  descriptionEn: String(form.get("descriptionEn") ?? ""),
                  directionsEn: String(form.get("directionsEn") ?? ""),
                  nameTh: String(form.get("nameTh") ?? ""),
                  taglineTh: String(form.get("taglineTh") ?? ""),
                  descriptionTh: String(form.get("descriptionTh") ?? ""),
                  directionsTh: String(form.get("directionsTh") ?? ""),
                  addressLine1: String(form.get("addressLine1") ?? ""),
                  addressLine2: String(form.get("addressLine2") ?? ""),
                  city: String(form.get("city") ?? ""),
                  province: String(form.get("province") ?? ""),
                  postalCode: String(form.get("postalCode") ?? ""),
                  country: String(form.get("country") ?? "TH"),
                  latitude: latRaw.length === 0 ? null : Number(latRaw),
                  longitude: lngRaw.length === 0 ? null : Number(lngRaw),
                  email: String(form.get("email") ?? ""),
                  phone: String(form.get("phone") ?? ""),
                  website: String(form.get("website") ?? ""),
                }).then((result) => {
                  setNotice(noticeFor(result, t("saved"), t("saveFailed")));
                  if (result.ok && result.data?.updatedAt !== undefined) {
                    setUpdatedAt(result.data.updatedAt);
                  }
                });
              });
            }}
          >
            <p className="text-sm text-muted-foreground">
              {t("timezoneReadOnly")}
            </p>
            <p className="text-sm" data-testid="venue-timezone">
              {profile.timezone}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="name">{t("operationalName")}</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={profile.name}
                  required
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nameEn">{t("nameEn")}</Label>
                <Input
                  id="nameEn"
                  name="nameEn"
                  defaultValue={profile.nameEn}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="taglineEn">{t("taglineEn")}</Label>
                <Input
                  id="taglineEn"
                  name="taglineEn"
                  defaultValue={profile.taglineEn}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nameTh">{t("nameTh")}</Label>
                <Input
                  id="nameTh"
                  name="nameTh"
                  defaultValue={profile.nameTh}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="descriptionEn">{t("descriptionEn")}</Label>
                <Textarea
                  id="descriptionEn"
                  name="descriptionEn"
                  defaultValue={profile.descriptionEn}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="descriptionTh">{t("descriptionTh")}</Label>
                <Textarea
                  id="descriptionTh"
                  name="descriptionTh"
                  defaultValue={profile.descriptionTh}
                  disabled={readOnly}
                />
              </div>
            </div>
            <h3 className="text-sm font-medium">{t("contactLocation")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("contactPublicHelp")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={profile.email}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={profile.phone}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="website">{t("website")}</Label>
                <Input
                  id="website"
                  name="website"
                  defaultValue={profile.website}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="addressLine1">{t("address")}</Label>
                <Input
                  id="addressLine1"
                  name="addressLine1"
                  defaultValue={profile.addressLine1}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="city">{t("city")}</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={profile.city}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="province">{t("province")}</Label>
                <Input
                  id="province"
                  name="province"
                  defaultValue={profile.province}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="postalCode">{t("postalCode")}</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  defaultValue={profile.postalCode}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="country">{t("country")}</Label>
                <Input
                  id="country"
                  name="country"
                  defaultValue={profile.country}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="latitude">{t("latitude")}</Label>
                <Input
                  id="latitude"
                  name="latitude"
                  defaultValue={profile.latitude}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="longitude">{t("longitude")}</Label>
                <Input
                  id="longitude"
                  name="longitude"
                  defaultValue={profile.longitude}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="directionsEn">{t("directionsEn")}</Label>
                <Textarea
                  id="directionsEn"
                  name="directionsEn"
                  defaultValue={profile.directionsEn}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="directionsTh">{t("directionsTh")}</Label>
                <Textarea
                  id="directionsTh"
                  name="directionsTh"
                  defaultValue={profile.directionsTh}
                  disabled={readOnly}
                />
              </div>
              <input
                type="hidden"
                name="addressLine2"
                defaultValue={profile.addressLine2}
              />
              <input
                type="hidden"
                name="taglineTh"
                defaultValue={profile.taglineTh}
              />
            </div>
            {canManageVenue ? (
              <Button type="submit" className="min-h-11">
                {t("saveProfile")}
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("hours")}</CardTitle>
          <CardDescription>{t("hoursHelp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (readOnly) {
                return;
              }
              const form = new FormData(event.currentTarget);
              const mode = String(form.get("hoursMode") ?? "unknown") as
                "unknown" | "scheduled";
              const week = ISO_WEEKDAYS.map((day) => {
                const closed = form.get(`closed-${String(day)}`) === "on";
                const intervals = [];
                for (
                  let slot = 0;
                  slot < VENUE_HOURS_MAX_INTERVALS;
                  slot += 1
                ) {
                  const opens = String(
                    form.get(`opens-${String(day)}-${String(slot)}`) ?? "",
                  )
                    .trim()
                    .slice(0, 5);
                  const closes = String(
                    form.get(`closes-${String(day)}-${String(slot)}`) ?? "",
                  )
                    .trim()
                    .slice(0, 5);
                  if (opens.length === 0 || closes.length === 0) {
                    continue;
                  }
                  intervals.push({
                    opens,
                    closes,
                    closesNextDay:
                      form.get(`overnight-${String(day)}-${String(slot)}`) ===
                      "on",
                  });
                }
                return {
                  day,
                  closed,
                  intervals: closed ? [] : intervals,
                };
              });
              const existingExceptions = profile.exceptions.map((row) => ({
                date: row.date,
                closed: row.closed,
                intervals: row.intervals,
                internalNote: row.internalNote,
              }));
              const exceptionDate = String(
                form.get("exceptionDate") ?? "",
              ).trim();
              const exceptions =
                exceptionDate.length === 0
                  ? existingExceptions
                  : [
                      ...existingExceptions.filter(
                        (row) => row.date !== exceptionDate,
                      ),
                      {
                        date: exceptionDate,
                        closed: form.get("exceptionClosed") === "on",
                        intervals:
                          form.get("exceptionClosed") === "on"
                            ? []
                            : [
                                {
                                  opens: String(
                                    form.get("exceptionOpens") ?? "12:00",
                                  ),
                                  closes: String(
                                    form.get("exceptionCloses") ?? "16:00",
                                  ),
                                  closesNextDay: false,
                                },
                              ],
                        internalNote: String(form.get("exceptionNote") ?? ""),
                      },
                    ];
              startTransition(() => {
                void saveVenueOpeningHoursAction({
                  venueId: profile.venueId,
                  expectedUpdatedAt: updatedAt,
                  mode,
                  week,
                  exceptions,
                }).then((result) => {
                  setNotice(noticeFor(result, t("saved"), t("saveFailed")));
                  if (result.ok && result.data?.updatedAt !== undefined) {
                    setUpdatedAt(result.data.updatedAt);
                  }
                });
              });
            }}
          >
            <Label htmlFor="hoursMode">{t("hoursMode")}</Label>
            <select
              id="hoursMode"
              name="hoursMode"
              defaultValue={profile.openingHoursMode}
              disabled={readOnly}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3"
            >
              <option value="unknown">{t("hoursUnknown")}</option>
              <option value="scheduled">{t("hoursScheduled")}</option>
            </select>
            <ul className="space-y-3">
              {profile.week.map((day) => {
                const slots = Array.from(
                  { length: VENUE_HOURS_MAX_INTERVALS },
                  (_, slot) => day.intervals[slot],
                );
                return (
                  <li
                    key={day.day}
                    className="grid gap-2 rounded-md border border-border p-3"
                  >
                    <p className="font-medium">
                      {t(
                        isoWeekdayMessageKey(
                          day.day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
                        ),
                      )}
                    </p>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={`closed-${String(day.day)}`}
                        defaultChecked={day.closed}
                        disabled={readOnly}
                      />
                      {t("closed")}
                    </label>
                    {slots.map((interval, slot) => (
                      <div
                        key={`${String(day.day)}-${String(slot)}`}
                        className="grid gap-2 sm:grid-cols-2"
                      >
                        <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
                          <input
                            type="checkbox"
                            name={`overnight-${String(day.day)}-${String(slot)}`}
                            defaultChecked={interval?.closesNextDay === true}
                            disabled={readOnly}
                          />
                          {t("overnight")}
                        </label>
                        <Input
                          name={`opens-${String(day.day)}-${String(slot)}`}
                          defaultValue={
                            interval?.opens ?? (slot === 0 ? "10:00" : "")
                          }
                          disabled={readOnly}
                          aria-label={t("opens")}
                        />
                        <Input
                          name={`closes-${String(day.day)}-${String(slot)}`}
                          defaultValue={
                            interval?.closes ?? (slot === 0 ? "22:00" : "")
                          }
                          disabled={readOnly}
                          aria-label={t("closes")}
                        />
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="font-medium">{t("exception")}</p>
              {profile.exceptions.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  <li className="font-medium">{t("existingExceptions")}</li>
                  {profile.exceptions.map((row) => (
                    <li key={row.date}>
                      {row.date}
                      {": "}
                      {row.closed ? t("closed") : row.intervals.length}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Label htmlFor="exceptionDate">{t("exceptionDate")}</Label>
              <Input
                id="exceptionDate"
                name="exceptionDate"
                type="date"
                disabled={readOnly}
              />
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="exceptionClosed"
                  disabled={readOnly}
                />
                {t("closed")}
              </label>
              <Input
                name="exceptionOpens"
                defaultValue="12:00"
                disabled={readOnly}
                aria-label={t("opens")}
              />
              <Input
                name="exceptionCloses"
                defaultValue="16:00"
                disabled={readOnly}
                aria-label={t("closes")}
              />
              <Input
                name="exceptionNote"
                disabled={readOnly}
                placeholder={t("internalNote")}
              />
            </div>
            {canManageVenue ? (
              <Button type="submit" className="min-h-11">
                {t("saveHours")}
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {canManageBranding ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("appearance")}</CardTitle>
            <CardDescription>{t("appearanceHelp")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                startTransition(() => {
                  void saveVenueBrandingAction({
                    venueId: profile.venueId,
                    themeKey: String(form.get("themeKey") ?? "system"),
                    fontKey: "system",
                    primaryColor: String(form.get("primaryColor") ?? "#171717"),
                    secondaryColor: String(
                      form.get("secondaryColor") ?? "#525252",
                    ),
                    accentColor: String(form.get("accentColor") ?? "#1D4ED8"),
                    backgroundColor: String(
                      form.get("backgroundColor") ?? "#FFFFFF",
                    ),
                    textColor: String(form.get("textColor") ?? "#171717"),
                  }).then((result) => {
                    setNotice(noticeFor(result, t("saved"), t("saveFailed")));
                  });
                });
              }}
            >
              <Label htmlFor="themeKey">{t("theme")}</Label>
              <select
                id="themeKey"
                name="themeKey"
                defaultValue={profile.branding?.themeKey ?? "system"}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="system">system</option>
                <option value="daylight">daylight</option>
                <option value="midnight">midnight</option>
              </select>
              <Input
                name="primaryColor"
                defaultValue={profile.branding?.primaryColor ?? "#171717"}
              />
              <Input
                name="secondaryColor"
                defaultValue={profile.branding?.secondaryColor ?? "#525252"}
              />
              <Input
                name="accentColor"
                defaultValue={profile.branding?.accentColor ?? "#1D4ED8"}
              />
              <Input
                name="backgroundColor"
                defaultValue={profile.branding?.backgroundColor ?? "#FFFFFF"}
              />
              <Input
                name="textColor"
                defaultValue={profile.branding?.textColor ?? "#171717"}
              />
              <p className="text-sm text-muted-foreground">
                {t("mediaDeferred")}
              </p>
              <Button type="submit" className="min-h-11">
                {t("saveAppearance")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("publication")}</CardTitle>
          <CardDescription>{t("publicationHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p data-testid="publication-state">
            {t("currentState")}: {profile.publicationState}
          </p>
          <p className="text-sm text-muted-foreground">{t("liveEdits")}</p>
          <Button asChild variant="secondary" className="min-h-11">
            <Link href={publicVenueHomePath(profile.slug) ?? "/"}>
              {t("viewPublicSite")}
            </Link>
          </Button>
          {canManageVenue && profile.publicationState === "draft" ? (
            <Button
              type="button"
              className="min-h-11"
              onClick={() => {
                startTransition(() => {
                  void setVenuePublicationAction({
                    venueId: profile.venueId,
                    expectedUpdatedAt: updatedAt,
                    publicationState: "published",
                  }).then((result) => {
                    setNotice(
                      noticeFor(result, t("published"), t("saveFailed")),
                    );
                    if (result.ok && result.data?.updatedAt !== undefined) {
                      setUpdatedAt(result.data.updatedAt);
                    }
                  });
                });
              }}
            >
              {t("publish")}
            </Button>
          ) : null}
          {canManageVenue && profile.publicationState === "published" ? (
            <ConfirmationDialog
              trigger={
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11"
                >
                  {t("unpublish")}
                </Button>
              }
              title={t("unpublishTitle")}
              description={t("unpublishHelp")}
              confirmLabel={t("unpublish")}
              cancelLabel={t("cancel")}
              destructive
              onConfirm={() => {
                startTransition(() => {
                  void setVenuePublicationAction({
                    venueId: profile.venueId,
                    expectedUpdatedAt: updatedAt,
                    publicationState: "draft",
                  }).then((result) => {
                    setNotice(
                      noticeFor(result, t("unpublished"), t("saveFailed")),
                    );
                    if (result.ok && result.data?.updatedAt !== undefined) {
                      setUpdatedAt(result.data.updatedAt);
                    }
                  });
                });
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
