import { publicVenueHomePath } from "./paths";

const POSITION_PREFIX = "vb.public-home-scroll.v1:";
const INTENT_KEY = "vb.public-home-scroll-intent.v1";
const MAX_SCROLL_Y = 1_000_000;
const MAX_PENDING_FRAMES = 12;

export type PublicHomeScrollIntent = "restore" | "top";

let pendingIntent: PublicHomeScrollIntent | null = null;

function canUseSessionStorage(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage !== null;
  } catch {
    return false;
  }
}

function positionKey(locale: string, slug: string): string | null {
  if (locale !== "en" && locale !== "th") {
    return null;
  }
  if (publicVenueHomePath(slug) === null) {
    return null;
  }
  return `${POSITION_PREFIX}${locale}:${slug}`;
}

export function readPublicHomeScrollY(
  locale: string,
  slug: string,
): number | null {
  const key = positionKey(locale, slug);
  if (key === null || !canUseSessionStorage()) {
    return null;
  }
  const raw = window.sessionStorage.getItem(key);
  if (raw === null) {
    return null;
  }
  if (!/^[0-9]+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_SCROLL_Y) {
    return null;
  }
  return value;
}

export function writePublicHomeScrollY(
  locale: string,
  slug: string,
  y: number,
): void {
  const key = positionKey(locale, slug);
  if (key === null || !canUseSessionStorage()) {
    return;
  }
  if (!Number.isFinite(y) || y < 0) {
    return;
  }
  const value = Math.min(MAX_SCROLL_Y, Math.round(y));
  window.sessionStorage.setItem(key, String(value));
}

export function setPublicHomeScrollIntent(
  intent: PublicHomeScrollIntent,
): void {
  pendingIntent = intent;
  holdOverflowAnchor();
  if (!canUseSessionStorage()) {
    return;
  }
  window.sessionStorage.setItem(INTENT_KEY, intent);
}

export function peekPublicHomeScrollIntent(): PublicHomeScrollIntent | null {
  if (pendingIntent === "restore" || pendingIntent === "top") {
    return pendingIntent;
  }
  if (!canUseSessionStorage()) {
    return null;
  }
  const raw = window.sessionStorage.getItem(INTENT_KEY);
  if (raw === "restore" || raw === "top") {
    return raw;
  }
  return null;
}

export function clearPublicHomeScrollIntent(): void {
  pendingIntent = null;
  if (!canUseSessionStorage()) {
    return;
  }
  window.sessionStorage.removeItem(INTENT_KEY);
}

export function holdOverflowAnchor(): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.style.overflowAnchor = "none";
}

export function releaseOverflowAnchor(): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.style.overflowAnchor = "";
}

export function applyPublicWindowScroll(top: number): void {
  if (typeof window === "undefined") {
    return;
  }
  const html = document.documentElement;
  const max = Math.max(0, html.scrollHeight - window.innerHeight);
  const y = Math.min(max, Math.max(0, Math.round(top)));
  window.scrollTo({ top: y, left: 0, behavior: "auto" });
}

const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

function isScrollbarPointer(event: PointerEvent): boolean {
  const root = document.documentElement;
  return event.target === root && event.clientX >= root.clientWidth;
}

export function schedulePublicHomeScrollRestore(
  top: number,
  isReady: () => boolean,
): () => void {
  const target = Math.max(0, Math.round(top));
  let stopped = false;
  let finishing = false;
  let frames = 0;
  let tickId = 0;
  let followId = 0;
  holdOverflowAnchor();

  const stop = (apply: boolean): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    window.cancelAnimationFrame(tickId);
    window.cancelAnimationFrame(followId);
    observer.disconnect();
    window.removeEventListener("wheel", onUserIntent);
    window.removeEventListener("touchmove", onUserIntent);
    window.removeEventListener("keydown", onKeyIntent);
    window.removeEventListener("pointerdown", onPointerIntent);
    if (apply && isReady()) {
      applyPublicWindowScroll(target);
    }
    releaseOverflowAnchor();
  };

  const onUserIntent = (): void => {
    stop(false);
  };

  const onKeyIntent = (event: KeyboardEvent): void => {
    if (SCROLL_KEYS.has(event.key)) {
      stop(false);
    }
  };

  const onPointerIntent = (event: PointerEvent): void => {
    if (isScrollbarPointer(event)) {
      stop(false);
    }
  };

  const consider = (): void => {
    if (stopped || finishing) {
      return;
    }
    frames += 1;
    const max = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    const ready = isReady();
    const tallEnough = target === 0 || max >= target;
    if ((ready && tallEnough) || frames >= MAX_PENDING_FRAMES) {
      if (!ready) {
        stop(false);
        return;
      }
      finishing = true;
      applyPublicWindowScroll(target);
      followId = window.requestAnimationFrame(() => {
        stop(true);
      });
      return;
    }
    tickId = window.requestAnimationFrame(consider);
  };

  const observer = new ResizeObserver(() => {
    consider();
  });
  window.addEventListener("wheel", onUserIntent, { passive: true });
  window.addEventListener("touchmove", onUserIntent, { passive: true });
  window.addEventListener("keydown", onKeyIntent);
  window.addEventListener("pointerdown", onPointerIntent);
  observer.observe(document.documentElement);

  tickId = window.requestAnimationFrame(consider);

  return () => {
    stop(false);
  };
}
