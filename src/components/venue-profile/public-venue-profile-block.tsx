import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { PublicHoursStatusText } from "@/components/venue-profile/public-hours-status";
import {
  formatIntervalLabel,
  isoWeekdayMessageKey,
} from "@/core/venue-profile/labels";
import {
  openStreetMapHref,
  publicHttpUrl,
  publicMailtoHref,
  publicTelHref,
} from "@/core/venue-profile/links";
import type { PublicVenueProfile } from "@/core/venue-profile/public-types";
import type {
  HoursException,
  WeeklyDaySchedule,
} from "@/core/venue-profile/hours";
import { ISO_WEEKDAYS } from "@/core/venue-profile/constants";

interface PublicVenueProfileBlockProps {
  profile: PublicVenueProfile;
  copy: {
    preview: string;
    about: string;
    contact: string;
    hours: string;
    timezone: string;
    getDirections: string;
    email: string;
    phone: string;
    website: string;
    hoursUnknown: string;
    hoursOpenListed: string;
    hoursClosedListed: string;
    closed: string;
    nextDay: string;
    weekdays: Record<string, string>;
    listedHoursDisclaimer: string;
    exceptions: string;
  };
}

function toWeek(profile: PublicVenueProfile): WeeklyDaySchedule[] {
  const closed = new Set(profile.closedWeekdays);
  return ISO_WEEKDAYS.map((day) => {
    const intervals = profile.weeklyIntervals
      .filter((row) => row.day === day)
      .map((row) => ({
        opens: row.opens,
        closes: row.closes,
        closesNextDay: row.closesNextDay,
      }));
    return {
      day,
      closed: closed.has(day) || intervals.length === 0,
      intervals,
    };
  });
}

function toExceptions(profile: PublicVenueProfile): HoursException[] {
  return profile.exceptions.map((row) => ({
    date: row.date,
    closed: row.closed,
    intervals: row.intervals.map((interval) => ({
      opens: interval.opens,
      closes: interval.closes,
      closesNextDay: interval.closesNextDay,
    })),
  }));
}

function formatAddress(profile: PublicVenueProfile): string | null {
  const parts = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.province,
    profile.postalCode,
    profile.country,
  ].filter((part): part is string => part !== null && part.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function PublicVenueProfileBlock({
  profile,
  copy,
}: PublicVenueProfileBlockProps): ReactElement | null {
  if (!profile.available) {
    return null;
  }
  const address = formatAddress(profile);
  const directionsHref = openStreetMapHref({
    latitude: profile.latitude,
    longitude: profile.longitude,
    address,
  });
  const week = toWeek(profile);
  const exceptions = toExceptions(profile);
  const email = profile.contacts.find((row) => row.type === "email");
  const phone = profile.contacts.find((row) => row.type === "phone");
  const website = profile.contacts.find((row) => row.type === "website");
  const mailHref = email ? publicMailtoHref(email.value) : null;
  const telHref = phone ? publicTelHref(phone.value) : null;
  const webHref = website ? publicHttpUrl(website.value) : null;

  return (
    <section className="space-y-4" data-testid="public-venue-profile">
      {profile.preview ? (
        <p
          className="rounded-md border border-border bg-secondary/60 px-3 py-2 text-sm"
          data-testid="venue-preview-banner"
        >
          {copy.preview}
        </p>
      ) : null}
      {profile.tagline !== null ? (
        <p className="text-base text-muted-foreground">{profile.tagline}</p>
      ) : null}
      {profile.description !== null ? (
        <div className="space-y-1">
          <h2 className="text-sm font-medium">{copy.about}</h2>
          <p className="whitespace-pre-wrap text-sm">{profile.description}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {mailHref !== null ? (
          <Button asChild variant="secondary" className="min-h-11">
            <a href={mailHref}>{copy.email}</a>
          </Button>
        ) : null}
        {telHref !== null ? (
          <Button asChild variant="secondary" className="min-h-11">
            <a href={telHref}>{copy.phone}</a>
          </Button>
        ) : null}
        {webHref !== null ? (
          <Button asChild variant="secondary" className="min-h-11">
            <a href={webHref} rel="noopener noreferrer" target="_blank">
              {copy.website}
            </a>
          </Button>
        ) : null}
        {directionsHref !== null ? (
          <Button asChild className="min-h-11">
            <a href={directionsHref} rel="noopener noreferrer" target="_blank">
              {copy.getDirections}
            </a>
          </Button>
        ) : null}
      </div>
      {address !== null ? (
        <p className="text-sm text-muted-foreground">{address}</p>
      ) : null}
      {profile.directions !== null ? (
        <p className="text-sm">{profile.directions}</p>
      ) : null}
      <div className="space-y-2">
        <h2 className="text-sm font-medium">{copy.hours}</h2>
        <PublicHoursStatusText
          mode={profile.hoursMode}
          timeZone={profile.timezone}
          week={week}
          exceptions={exceptions}
          copy={{
            unknown: copy.hoursUnknown,
            openListed: copy.hoursOpenListed,
            closedListed: copy.hoursClosedListed,
          }}
        />
        <p className="text-xs text-muted-foreground">
          {copy.listedHoursDisclaimer}
        </p>
        {profile.hoursMode === "scheduled" ? (
          <details className="rounded-md border border-border p-3">
            <summary className="min-h-11 cursor-pointer text-sm font-medium">
              {copy.timezone}: {profile.timezone}
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {week.map((day) => (
                <li key={day.day}>
                  <span className="font-medium">
                    {copy.weekdays[isoWeekdayMessageKey(day.day)]}
                  </span>
                  {": "}
                  {day.closed
                    ? copy.closed
                    : day.intervals
                        .map((interval) =>
                          formatIntervalLabel(
                            interval.opens,
                            interval.closes,
                            interval.closesNextDay,
                            copy.nextDay,
                          ),
                        )
                        .join(", ")}
                </li>
              ))}
            </ul>
            {exceptions.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="font-medium">{copy.exceptions}</p>
                <ul className="space-y-1">
                  {exceptions.map((row) => (
                    <li key={row.date}>
                      {row.date}
                      {": "}
                      {row.closed
                        ? copy.closed
                        : row.intervals
                            .map((interval) =>
                              formatIntervalLabel(
                                interval.opens,
                                interval.closes,
                                interval.closesNextDay,
                                copy.nextDay,
                              ),
                            )
                            .join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </details>
        ) : null}
      </div>
    </section>
  );
}
