import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../messages/en.json";
import { loadMorePublicOffersAction } from "@/core/offers/actions";
import type { PublicVenueOffersPayload } from "@/core/offers/public-types";

vi.mock("@/core/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/core/offers/actions", () => ({
  loadMorePublicOffersAction: vi.fn(),
}));

const { PublicOffersList } =
  await import("@/components/offers/public-offers-list");

const loadMore = vi.mocked(loadMorePublicOffersAction);

function payload(
  items: PublicVenueOffersPayload["items"],
  nextCursor: string | null = null,
): PublicVenueOffersPayload {
  return {
    available: true,
    ok: true,
    heading: null,
    previewEnabled: true,
    previewCount: 3,
    timezone: "Asia/Bangkok",
    items,
    nextCursor,
    locale: "en",
  };
}

const liveItem = {
  title: "Live lunch",
  description: "d",
  terms: "t",
  validFrom: "2020-01-01T00:00:00.000Z",
  validUntil: "2099-01-01T00:00:00.000Z",
  locale: "en" as const,
};

const expiredItem = {
  title: "Expired lunch",
  description: "d",
  terms: "t",
  validFrom: "2020-01-01T00:00:00.000Z",
  validUntil: "2020-01-02T00:00:00.000Z",
  locale: "en" as const,
};

const extraItem = {
  title: "Second lunch",
  description: "d",
  terms: "t",
  validFrom: "2020-01-01T00:00:00.000Z",
  validUntil: "2099-01-01T00:00:00.000Z",
  locale: "en" as const,
};

function renderList(initial: PublicVenueOffersPayload) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PublicOffersList
        venueSlug="harbor-light"
        locale="en"
        initial={initial}
      />
    </NextIntlClientProvider>,
  );
}

describe("PublicOffersList", () => {
  afterEach(() => {
    vi.useRealTimers();
    loadMore.mockReset();
  });

  it("hides offers that are no longer live after a server refresh", () => {
    const { rerender } = renderList(payload([liveItem]));
    expect(screen.getByText("Live lunch")).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PublicOffersList
          venueSlug="harbor-light"
          locale="en"
          initial={payload([expiredItem])}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText("Live lunch")).not.toBeInTheDocument();
    expect(screen.queryByText("Expired lunch")).not.toBeInTheDocument();
    expect(screen.getByText(messages.offersPublic.empty)).toBeInTheDocument();
  });

  it("hides a live offer once its expiry timer fires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    renderList(
      payload([
        {
          ...liveItem,
          title: "Short lunch",
          validUntil: "2026-01-01T00:00:00.400Z",
        },
      ]),
    );
    expect(screen.getByText("Short lunch")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText("Short lunch")).not.toBeInTheDocument();
    expect(screen.getByText(messages.offersPublic.empty)).toBeInTheDocument();
  });

  it("keeps loaded pages when the server snapshot identity is unchanged", async () => {
    const user = userEvent.setup();
    const items = [liveItem];
    const initial = payload(items, "cursor-1");
    loadMore.mockResolvedValue(payload([extraItem]));

    const { rerender } = renderList(initial);
    await user.click(
      screen.getByRole("button", { name: messages.offersPublic.loadMore }),
    );
    expect(screen.getByText("Live lunch")).toBeInTheDocument();
    expect(screen.getByText("Second lunch")).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PublicOffersList
          venueSlug="harbor-light"
          locale="en"
          initial={payload(items, "cursor-1")}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Live lunch")).toBeInTheDocument();
    expect(screen.getByText("Second lunch")).toBeInTheDocument();
  });
});
