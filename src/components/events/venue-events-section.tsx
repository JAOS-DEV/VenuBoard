import type { AppLocale } from "@/core/i18n/routing";
import type {
  PublicEventItem,
  PublicVenueEventsPayload,
} from "@/core/events/public-types";
import {
  formatVenueDateTimeRange,
  venueLocalDateISO,
} from "@/core/events/timezone";
import { VenueEventsCalendar } from "./venue-events-calendar";

export function VenueEventsSection(props: {
  locale: AppLocale;
  upcoming: PublicVenueEventsPayload;
  archive: PublicVenueEventsPayload | null;
  branding?: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    accentColor: string;
  } | null;
}): React.ReactElement | null {
  const { upcoming, archive } = props;
  const timezone = upcoming.timezone ?? archive?.timezone;
  if (!upcoming.available || !timezone) {
    return null;
  }

  const defaultDisplay = upcoming.defaultDisplay;
  const locale: "en" | "th" = props.locale === "th" ? "th" : "en";

  const itemsForCalendar: PublicEventItem[] = [
    ...upcoming.items,
    ...(archive?.available ? archive.items : []),
  ];

  const now = new Date();
  const todayISO = venueLocalDateISO(now, timezone);
  const initialMonthKey = todayISO.slice(0, 7);

  return (
    <section
      className="space-y-4 rounded-md border bg-card p-4"
      style={
        props.branding
          ? ({
              borderColor: props.branding.accentColor,
            } as React.CSSProperties)
          : undefined
      }
      aria-label="Upcoming events"
    >
      {upcoming.heading ? (
        <h2 className="text-xl font-semibold">{upcoming.heading}</h2>
      ) : null}

      {defaultDisplay === "upcoming_list" ||
      defaultDisplay === "calendar_and_list" ? (
        <div className="space-y-2">
          <ol className="space-y-3" aria-label="Event list">
            {[...upcoming.items]
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .map((e) => {
                const { summary } = formatVenueDateTimeRange({
                  startsAt: e.startsAt,
                  endsAt: e.endsAt,
                  timeZone: timezone,
                  locale,
                  isAllDay: e.isAllDay,
                });
                return (
                  <li key={e.id} className="space-y-1">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {summary}
                    </div>
                    {e.summary ? (
                      <div className="text-sm">{e.summary}</div>
                    ) : null}
                  </li>
                );
              })}
          </ol>
        </div>
      ) : null}

      {defaultDisplay === "calendar_and_list" ? (
        <VenueEventsCalendar
          timezone={timezone}
          locale={locale}
          heading={
            upcoming.heading
              ? `${upcoming.heading} calendar`
              : "Events calendar"
          }
          events={itemsForCalendar}
          initialSelectedDateISO={todayISO}
          initialMonthKey={initialMonthKey}
          showPastArchive={upcoming.showPastArchive}
        />
      ) : null}
    </section>
  );
}
