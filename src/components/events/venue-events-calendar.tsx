"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicEventItem } from "@/core/events/public-types";
import {
  addDaysToDateOnly,
  formatVenueDateTimeRange,
  isLocalMidnightEnd,
  venueLocalDateISO,
} from "@/core/events/timezone";

type Locale = "en" | "th";

function dateOnlyToUtcMillis(dateISO: string): number {
  const parts = dateISO.split("-");
  if (parts.length !== 3) {
    return Date.UTC(1970, 0, 1);
  }
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return Date.UTC(1970, 0, 1);
  }
  return Date.UTC(y, m - 1, d);
}

function compareDateISO(a: string, b: string): number {
  return dateOnlyToUtcMillis(a) - dateOnlyToUtcMillis(b);
}

function monthKeyToMonthIndex(monthKey: string): {
  year: number;
  month0: number;
} {
  const parts = monthKey.split("-");
  if (parts.length !== 2) {
    return { year: 1970, month0: 0 };
  }
  const year = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(mm)) {
    return { year: 1970, month0: 0 };
  }
  return { year, month0: mm - 1 };
}

function isoFromYearMonthDay(
  year: number,
  month0: number,
  day: number,
): string {
  const mm = String(month0 + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function shiftMonth(monthKey: string, deltaMonths: number): string {
  const { year, month0 } = monthKeyToMonthIndex(monthKey);
  const next = new Date(Date.UTC(year, month0, 1));
  next.setUTCMonth(next.getUTCMonth() + deltaMonths);
  return isoFromYearMonthDay(
    next.getUTCFullYear(),
    next.getUTCMonth(),
    1,
  ).slice(0, 7);
}

export function VenueEventsCalendar(props: {
  timezone: string;
  locale: Locale;
  heading?: string | null;
  events: PublicEventItem[];
  initialSelectedDateISO: string;
  initialMonthKey: string; // YYYY-MM
  showPastArchive: boolean;
}): React.ReactElement {
  const { timezone, locale, events, initialSelectedDateISO, initialMonthKey } =
    props;

  const [selectedDateISO, setSelectedDateISO] = useState(
    initialSelectedDateISO,
  );
  const [monthKey, setMonthKey] = useState(initialMonthKey);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const dayButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const normalizedEvents = useMemo(() => {
    return events
      .map((e) => {
        const startInstant = new Date(e.startsAt);
        const endInstant = new Date(e.endsAt);
        const startDayISO = venueLocalDateISO(startInstant, timezone);
        const endDayISO = venueLocalDateISO(endInstant, timezone);

        // end boundary is exclusive; if event ends exactly at local midnight,
        // it does not overlap that end day.
        const endDayInclusive = isLocalMidnightEnd(endInstant, timezone)
          ? addDaysToDateOnly(endDayISO, -1)
          : endDayISO;

        return {
          ...e,
          _startDayISO: startDayISO,
          _endDayInclusiveISO: endDayInclusive,
          _startsAtInstant: startInstant,
        };
      })
      .sort(
        (a, b) => a._startsAtInstant.getTime() - b._startsAtInstant.getTime(),
      );
  }, [events, timezone]);

  const bounds = useMemo(() => {
    if (normalizedEvents.length === 0) {
      return { minMonthKey: monthKey, maxMonthKey: monthKey };
    }

    const first = normalizedEvents.at(0);
    if (!first) {
      return { minMonthKey: monthKey, maxMonthKey: monthKey };
    }
    let minDay = first._startDayISO;
    let maxDay = first._endDayInclusiveISO;
    for (const e of normalizedEvents) {
      if (compareDateISO(e._startDayISO, minDay) < 0) minDay = e._startDayISO;
      if (compareDateISO(e._endDayInclusiveISO, maxDay) > 0) {
        maxDay = e._endDayInclusiveISO;
      }
    }

    const minMonthKey = minDay.slice(0, 7);
    const maxMonthKey = maxDay.slice(0, 7);

    // If archived/past is not enabled, clamp to the month containing the
    // initially-selected date.
    if (!props.showPastArchive) {
      const nowMonthKey = initialMonthKey;
      return {
        minMonthKey: nowMonthKey,
        maxMonthKey,
      };
    }

    return { minMonthKey, maxMonthKey };
  }, [normalizedEvents, props.showPastArchive, monthKey, initialMonthKey]);

  const { year, month0 } = useMemo(
    () => monthKeyToMonthIndex(monthKey),
    [monthKey],
  );

  const monthFirstISO = isoFromYearMonthDay(year, month0, 1);
  const monthFirstUtc = dateOnlyToUtcMillis(monthFirstISO);
  const gridStartUtc =
    monthFirstUtc - new Date(monthFirstUtc).getUTCDay() * 86400000;
  const gridStartISO = new Date(gridStartUtc).toISOString().slice(0, 10);

  const dayCells = useMemo(() => {
    return Array.from({ length: 42 }, (_, idx) =>
      addDaysToDateOnly(gridStartISO, idx),
    );
  }, [gridStartISO]);

  const eventsByDay = useMemo(() => {
    const byDay = new Map<string, PublicEventItem[]>();
    for (const iso of dayCells) byDay.set(iso, []);

    for (const e of normalizedEvents) {
      const start = dateOnlyToUtcMillis(e._startDayISO);
      const end = dateOnlyToUtcMillis(e._endDayInclusiveISO);
      for (
        let t = start;
        t <= end;
        t += 86400000 // day increments in UTC date-only space
      ) {
        const iso = new Date(t).toISOString().slice(0, 10);
        const list = byDay.get(iso);
        if (list) list.push(e);
      }
    }
    return byDay;
  }, [normalizedEvents, dayCells]);

  const onSelectDate = (iso: string) => {
    setSelectedDateISO(iso);
    const targetMonthKey = iso.slice(0, 7);
    if (targetMonthKey !== monthKey) {
      setMonthKey(targetMonthKey);
    }
  };

  useEffect(() => {
    const btn = dayButtonRefs.current.get(selectedDateISO);
    btn?.focus();
  }, [selectedDateISO, monthKey]);

  const canGoPrev = monthKey > bounds.minMonthKey;
  const canGoNext = monthKey < bounds.maxMonthKey;

  const todayISO = props.initialSelectedDateISO;
  const selectedEvents = eventsByDay.get(selectedDateISO) ?? [];
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <section
      className="space-y-3"
      aria-label={props.heading ?? "Events calendar"}
    >
      {props.heading ? (
        <h2 className="text-base font-semibold">{props.heading}</h2>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMonthKey((m) => shiftMonth(m, -1))}
          disabled={!canGoPrev}
          aria-label="Previous month"
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-sm disabled:opacity-50"
        >
          Prev
        </button>
        <div
          aria-live="polite"
          className="min-w-0 flex-1 text-center text-sm font-medium"
        >
          {monthKey}
        </div>
        <button
          type="button"
          onClick={() => setMonthKey((m) => shiftMonth(m, 1))}
          disabled={!canGoNext}
          aria-label="Next month"
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {weekdayLabels.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        className="space-y-1"
        role="grid"
        tabIndex={0}
        onKeyDown={(e) => {
          if (normalizedEvents.length === 0) return;

          const key = e.key;
          const dayDelta =
            key === "ArrowLeft"
              ? -1
              : key === "ArrowRight"
                ? 1
                : key === "ArrowUp"
                  ? -7
                  : key === "ArrowDown"
                    ? 7
                    : null;

          if (dayDelta !== null) {
            e.preventDefault();
            const next = addDaysToDateOnly(selectedDateISO, dayDelta);
            onSelectDate(next);
            return;
          }

          if (key === "PageUp") {
            e.preventDefault();
            setMonthKey((m) => shiftMonth(m, -1));
            return;
          }
          if (key === "PageDown") {
            e.preventDefault();
            setMonthKey((m) => shiftMonth(m, 1));
            return;
          }
        }}
      >
        {Array.from({ length: 6 }, (_, week) => (
          <div key={week} role="row" className="grid grid-cols-7 gap-1">
            {dayCells.slice(week * 7, week * 7 + 7).map((iso) => {
              const list = eventsByDay.get(iso) ?? [];
              const isSelected = iso === selectedDateISO;
              const isToday = iso === todayISO;
              const inMonth = iso.slice(0, 7) === monthKey;
              const listCount = list.length;
              return (
                <div key={iso} role="gridcell" className="aspect-square">
                  <button
                    type="button"
                    ref={(el) => {
                      if (!el) return;
                      dayButtonRefs.current.set(iso, el);
                    }}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => onSelectDate(iso)}
                    aria-label={`Select ${iso}`}
                    aria-current={isToday ? "date" : undefined}
                    aria-pressed={isSelected}
                    className={`flex size-full min-h-11 flex-col items-center justify-center rounded-md text-sm ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : isToday
                          ? "ring-1 ring-ring"
                          : ""
                    } ${inMonth ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    <span className="leading-none">
                      {Number(iso.slice(8, 10))}
                    </span>
                    {listCount > 0 ? (
                      <span
                        className={`mt-1 size-1.5 rounded-full ${
                          isSelected ? "bg-primary-foreground" : "bg-foreground"
                        }`}
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="mt-1 size-1.5" aria-hidden="true" />
                    )}
                    <span className="sr-only">
                      {listCount > 0
                        ? `${String(listCount)} events`
                        : "No events"}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="space-y-2" aria-live="polite">
        <h3 className="text-sm font-medium">{selectedDateISO}</h3>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No events on this day.
          </p>
        ) : (
          <ol className="space-y-2" aria-label="Event list">
            {selectedEvents.map((e) => {
              const { summary } = formatVenueDateTimeRange({
                startsAt: e.startsAt,
                endsAt: e.endsAt,
                isAllDay: e.isAllDay,
                timeZone: timezone,
                locale,
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
        )}
      </div>
    </section>
  );
}
