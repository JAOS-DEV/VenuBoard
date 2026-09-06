"use client";

import { useEffect } from "react";
import { useRouter } from "@/core/i18n/navigation";
import { nextPublicOfferRefreshAt } from "@/core/offers/expiry";
import type { PublicOfferItem } from "@/core/offers/public-types";

interface PublicOfferExpiryWatcherProps {
  items: readonly PublicOfferItem[];
  onTick?: () => void;
}

export function PublicOfferExpiryWatcher({
  items,
  onTick,
}: PublicOfferExpiryWatcherProps): null {
  const router = useRouter();

  useEffect(() => {
    function refresh(): void {
      onTick?.();
      router.refresh();
    }

    function onVisibility(): void {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);

    const nextAt = nextPublicOfferRefreshAt(items);
    let timer: number | null = null;
    if (nextAt !== null) {
      const delay = Math.max(0, nextAt - Date.now());
      timer = window.setTimeout(refresh, Math.min(delay + 50, 2_147_000_000));
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [items, onTick, router]);

  return null;
}
