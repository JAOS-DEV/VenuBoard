import type { AppLocale } from "@/core/i18n/routing";
import type {
  PublicEventItem,
  PublicVenueEventsPayload,
} from "@/core/events/public-types";
import {
  formatVenueDateTimeRange,
  venueLocalDateISO,
} from "@/core/events/timezone";
import { PublicModuleSection } from "@/components/patterns/public-module-section";
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
  const headingId = "public-events-heading";

  if (upcoming.items.length === 0 && defaultDisplay === "upcoming_list") {
    return null;
  }

  return (
    <PublicModuleSection
      heading={upcoming.heading}
      headingId={upcoming.heading ? headingId : undefined}
    >
      {defaultDisplay === "upcoming_list" ||
      defaultDisplay === "calendar_and_list" ? (
        <ol className="space-y-2" aria-label="Event list">
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
                <li
                  key={e.id}
                  className="rounded-lg bg-card p-3 ring-1 ring-border"
                >
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">{summary}</p>
                  {e.summary ? (
                    <p className="mt-1 text-sm">{e.summary}</p>
                  ) : null}
                </li>
              );
            })}
        </ol>
      ) : null}

      {defaultDisplay === "calendar_and_list" ? (
        <VenueEventsCalendar
          timezone={timezone}
          locale={locale}
          heading={null}
          events={itemsForCalendar}
          initialSelectedDateISO={todayISO}
          initialMonthKey={initialMonthKey}
          showPastArchive={upcoming.showPastArchive}
        />
      ) : null}
    </PublicModuleSection>
  );
}
