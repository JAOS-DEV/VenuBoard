"use client";

import { useCallback, useEffect, useState } from "react";

import { listedHoursStatus } from "@/core/venue-profile/hours";
import type {
  HoursException,
  WeeklyDaySchedule,
} from "@/core/venue-profile/hours";

interface PublicHoursStatusWatcherProps {
  mode: "unknown" | "scheduled";
  timeZone: string;
  week: WeeklyDaySchedule[];
  exceptions: HoursException[];
  onTick: () => void;
}

export function PublicHoursStatusWatcher({
  mode,
  timeZone,
  week,
  exceptions,
  onTick,
}: PublicHoursStatusWatcherProps): null {
  useEffect(() => {
    function refresh(): void {
      onTick();
    }
    function onVisibility(): void {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    const listed = listedHoursStatus({ mode, timeZone, week, exceptions });
    let timer: number | null = null;
    if (listed.nextTransitionAtMs !== null) {
      const delay = Math.max(0, listed.nextTransitionAtMs - Date.now());
      timer = window.setTimeout(refresh, Math.min(delay + 50, 2_147_000_000));
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [mode, timeZone, week, exceptions, onTick]);
  return null;
}

interface PublicHoursStatusTextProps {
  mode: "unknown" | "scheduled";
  timeZone: string;
  week: WeeklyDaySchedule[];
  exceptions: HoursException[];
  copy: {
    unknown: string;
    openListed: string;
    closedListed: string;
  };
}

export function PublicHoursStatusText({
  mode,
  timeZone,
  week,
  exceptions,
  copy,
}: PublicHoursStatusTextProps): React.ReactElement {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const onTick = useCallback(() => {
    setNowMs(Date.now());
  }, []);
  const listed = listedHoursStatus({
    mode,
    timeZone,
    week,
    exceptions,
    now: new Date(nowMs),
  });
  const label =
    listed.status === "open_listed"
      ? copy.openListed
      : listed.status === "closed_listed"
        ? copy.closedListed
        : copy.unknown;
  return (
    <>
      <PublicHoursStatusWatcher
        mode={mode}
        timeZone={timeZone}
        week={week}
        exceptions={exceptions}
        onTick={onTick}
      />
      <p className="text-sm text-muted-foreground" data-testid="hours-status">
        {label}
      </p>
    </>
  );
}
