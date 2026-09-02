"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PublicStaffCarousel } from "@/core/staff-presence/public-map";

interface StaffCarouselProps {
  carousel: PublicStaffCarousel;
  headingFallback: string;
  inNowLabel: string;
  notInLabel: string;
  emptyLabel: string;
  previousLabel: string;
  nextLabel: string;
  pauseLabel: string;
  playLabel: string;
  branding?: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    accentColor: string;
  } | null;
}

export function StaffCarousel({
  carousel,
  headingFallback,
  inNowLabel,
  notInLabel,
  emptyLabel,
  previousLabel,
  nextLabel,
  pauseLabel,
  playLabel,
  branding,
}: StaffCarouselProps): React.ReactElement {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => {
      setReducedMotion(media.matches);
    };
    update();
    media.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (
      !carousel.autoAdvance ||
      paused ||
      reducedMotion ||
      carousel.items.length < 2
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const node = scrollerRef.current;
      if (node === null) {
        return;
      }
      const nextLeft = node.scrollLeft + node.clientWidth;
      if (nextLeft + 8 >= node.scrollWidth) {
        node.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        node.scrollBy({ left: node.clientWidth, behavior: "smooth" });
      }
    }, 6000);

    return () => {
      window.clearInterval(timer);
    };
  }, [carousel.autoAdvance, carousel.items.length, paused, reducedMotion]);

  function scrollByPage(direction: -1 | 1): void {
    const node = scrollerRef.current;
    if (node === null) {
      return;
    }
    node.scrollBy({
      left: direction * node.clientWidth,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  if (!carousel.available) {
    return <></>;
  }

  const heading = carousel.heading ?? headingFallback;
  const style =
    branding === null || branding === undefined
      ? undefined
      : ({
          backgroundColor: branding.backgroundColor,
          color: branding.textColor,
          borderColor: branding.primaryColor,
        } as const);

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-xl border p-4 sm:p-6"
      style={style}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-xl font-semibold tracking-tight">
          {heading}
        </h2>
        {carousel.items.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                scrollByPage(-1);
              }}
            >
              {previousLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                scrollByPage(1);
              }}
            >
              {nextLabel}
            </Button>
            {carousel.autoAdvance && !reducedMotion ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPaused((value) => !value);
                }}
              >
                {paused ? playLabel : pauseLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {carousel.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              scrollByPage(1);
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              scrollByPage(-1);
            }
          }}
        >
          {carousel.items.map((item) => (
            <article
              key={item.publicId}
              className="min-w-[16rem] max-w-xs snap-start rounded-lg border border-border bg-card p-4 text-card-foreground"
            >
              <div
                className="mb-3 flex size-16 items-center justify-center rounded-full text-lg font-semibold"
                style={
                  branding === null || branding === undefined
                    ? undefined
                    : {
                        backgroundColor: branding.accentColor,
                        color: branding.backgroundColor,
                      }
                }
                aria-hidden="true"
              >
                {item.initials}
              </div>
              <h3 className="text-base font-semibold">{item.displayName}</h3>
              {item.title !== null ? (
                <p className="text-sm text-muted-foreground">{item.title}</p>
              ) : null}
              {item.bio !== null ? (
                <p className="mt-2 text-sm">{item.bio}</p>
              ) : null}
              <Badge
                className="mt-3"
                variant={
                  item.presenceState === "present" ? "default" : "outline"
                }
              >
                {item.presenceState === "present" ? inNowLabel : notInLabel}
              </Badge>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
