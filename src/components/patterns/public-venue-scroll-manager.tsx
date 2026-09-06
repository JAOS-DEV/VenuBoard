"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { usePathname } from "@/core/i18n/navigation";
import {
  applyPublicWindowScroll,
  clearPublicHomeScrollIntent,
  peekPublicHomeScrollIntent,
  readPublicHomeScrollY,
  releaseOverflowAnchor,
  schedulePublicHomeScrollRestore,
  setPublicHomeScrollIntent,
  writePublicHomeScrollY,
} from "@/core/public-venue/scroll-state";
import { isPublicVenueHomePath } from "@/core/public-venue/paths";

interface PublicVenueScrollManagerProps {
  venueSlug: string;
  locale: "en" | "th";
  children: ReactNode;
}

function isHashOnlyHref(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href");
  return href !== null && href.startsWith("#");
}

function dialogIsOpen(): boolean {
  return document.querySelector('[role="dialog"][data-state="open"]') !== null;
}

function bodyScrollLocked(): boolean {
  return window.getComputedStyle(document.body).overflow === "hidden";
}

function closestAnchor(event: MouseEvent): HTMLAnchorElement | null {
  for (const item of event.composedPath()) {
    if (item instanceof HTMLAnchorElement) {
      return item;
    }
  }
  return null;
}

let lastPositiveSaveAt = 0;
let lastSeenY = 0;

function saveHomeScrollY(
  locale: string,
  venueSlug: string,
  source: "scroll" | "click",
): void {
  const y = window.scrollY;
  if (source === "scroll" && lastSeenY - y > 80) {
    lastSeenY = y;
    return;
  }
  lastSeenY = y;
  if (y < 40) {
    if (source === "click" || dialogIsOpen() || bodyScrollLocked()) {
      return;
    }
    if (performance.now() - lastPositiveSaveAt < 2_000) {
      return;
    }
  }
  if (y > 0) {
    lastPositiveSaveAt = performance.now();
  }
  writePublicHomeScrollY(locale, venueSlug, y);
}

export function PublicVenueScrollManager({
  venueSlug,
  locale,
  children,
}: PublicVenueScrollManagerProps): ReactElement {
  const pathname = usePathname();
  const onHome = isPublicVenueHomePath(pathname, venueSlug);
  const poppedRef = useRef(false);
  const ignoreScrollSaveRef = useRef(false);
  const cancelRestoreRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    function onPopState(): void {
      poppedRef.current = true;
    }
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useLayoutEffect(() => {
    if (!onHome) {
      ignoreScrollSaveRef.current = false;
      cancelRestoreRef.current?.();
      cancelRestoreRef.current = null;
      if (peekPublicHomeScrollIntent() === null) {
        releaseOverflowAnchor();
      }
      return;
    }
    return () => {
      cancelRestoreRef.current?.();
      cancelRestoreRef.current = null;
      if (
        ignoreScrollSaveRef.current ||
        window.scrollY < 40 ||
        dialogIsOpen() ||
        bodyScrollLocked()
      ) {
        return;
      }
      writePublicHomeScrollY(locale, venueSlug, window.scrollY);
    };
  }, [locale, onHome, venueSlug]);

  useLayoutEffect(() => {
    if (!onHome) {
      return;
    }
    const intent = peekPublicHomeScrollIntent();
    const popped = poppedRef.current;
    poppedRef.current = false;
    if (intent === null && !popped) {
      return;
    }
    const saved = readPublicHomeScrollY(locale, venueSlug);
    let target: number | null = null;
    if (intent === "top") {
      target = 0;
    } else if (intent === "restore") {
      target = saved ?? 0;
    } else if (saved !== null) {
      target = saved;
    }
    clearPublicHomeScrollIntent();
    if (target === null) {
      releaseOverflowAnchor();
      return;
    }
    cancelRestoreRef.current?.();
    const homepageReady = (): boolean =>
      isPublicVenueHomePath(window.location.pathname, venueSlug);
    cancelRestoreRef.current = schedulePublicHomeScrollRestore(
      target,
      homepageReady,
    );
    return () => {
      cancelRestoreRef.current?.();
      cancelRestoreRef.current = null;
    };
  }, [locale, onHome, venueSlug]);

  useLayoutEffect(() => {
    if (!onHome) {
      return;
    }
    const saveFromScroll = (): void => {
      if (
        ignoreScrollSaveRef.current ||
        peekPublicHomeScrollIntent() !== null
      ) {
        return;
      }
      saveHomeScrollY(locale, venueSlug, "scroll");
    };
    window.addEventListener("scroll", saveFromScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", saveFromScroll);
    };
  }, [locale, onHome, venueSlug]);

  useEffect(() => {
    function onClick(event: MouseEvent): void {
      const anchor = closestAnchor(event);
      if (anchor === null || isHashOnlyHref(anchor)) {
        return;
      }
      if (onHome) {
        saveHomeScrollY(locale, venueSlug, "click");
      }
      if (!isPublicVenueHomePath(anchor.pathname, venueSlug)) {
        if (onHome) {
          ignoreScrollSaveRef.current = true;
        }
        return;
      }
      if (anchor.dataset.testid === "public-venue-back") {
        setPublicHomeScrollIntent("restore");
        return;
      }
      setPublicHomeScrollIntent("top");
      if (onHome) {
        cancelRestoreRef.current?.();
        cancelRestoreRef.current = null;
        applyPublicWindowScroll(0);
      }
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [locale, onHome, venueSlug]);

  return <>{children}</>;
}
