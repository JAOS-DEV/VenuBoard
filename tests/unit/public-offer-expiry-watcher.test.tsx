import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PublicOfferItem } from "@/core/offers/public-types";

const refresh = vi.fn();

vi.mock("@/core/i18n/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const { PublicOfferExpiryWatcher } =
  await import("@/components/offers/public-offer-expiry-watcher");

const liveItem: PublicOfferItem = {
  title: "Short lunch",
  description: "d",
  terms: "t",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2026-01-01T00:00:00.400Z",
  locale: "en",
};

describe("PublicOfferExpiryWatcher", () => {
  afterEach(() => {
    vi.useRealTimers();
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("refreshes when the next offer expires", () => {
    const onTick = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    render(<PublicOfferExpiryWatcher items={[liveItem]} onTick={onTick} />);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the tab becomes visible again", () => {
    const onTick = vi.fn();
    vi.stubGlobal("document", document);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    render(<PublicOfferExpiryWatcher items={[liveItem]} onTick={onTick} />);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
