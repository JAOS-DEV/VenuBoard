"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicModuleSection } from "@/components/patterns/public-module-section";
import { EmptyState } from "@/components/patterns/empty-state";
import type { PublicStaffCarousel } from "@/core/staff-presence/public-map";
import { safeAvatarStyle } from "@/core/ui/branding";
import { cn } from "@/lib/utils";

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
  const accentStyle = safeAvatarStyle(branding);

  return (
    <PublicModuleSection heading={heading} headingId={headingId}>
      {carousel.items.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              scrollByPage(-1);
            }}
          >
            {previousLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
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
              size="sm"
              onClick={() => {
                setPaused((value) => !value);
              }}
            >
              {paused ? playLabel : pauseLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      {carousel.items.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
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
          {carousel.items.map((item) => {
            const present = item.presenceState === "present";
            return (
              <article
                key={item.publicId}
                className="min-w-[14rem] max-w-[16rem] shrink-0 snap-start rounded-lg bg-card p-3 text-card-foreground ring-1 ring-border"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold"
                    style={accentStyle}
                    aria-hidden="true"
                  >
                    {item.initials}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="truncate text-sm font-semibold">
                      {item.displayName}
                    </h3>
                    {item.title !== null ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.title}
                      </p>
                    ) : null}
                    <Badge
                      variant={present ? "present" : "notPresent"}
                      className={cn(!present && "font-normal")}
                    >
                      {present ? inNowLabel : notInLabel}
                    </Badge>
                  </div>
                </div>
                {item.bio !== null ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {item.bio}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </PublicModuleSection>
  );
}
