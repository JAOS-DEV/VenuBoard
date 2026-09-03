import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { atmosphereBadgeVariant } from "@/core/atmosphere/labels";
import type { PublicAtmosphereCard as PublicAtmosphereCardData } from "@/core/atmosphere/public-map";
import { cn } from "@/lib/utils";

interface PublicAtmosphereCardProps {
  atmosphere: PublicAtmosphereCardData;
  statusLabel: string;
  headingFallback: string;
  disclaimer: string;
  freshnessLabel: string;
}

export function PublicAtmosphereCard({
  atmosphere,
  statusLabel,
  headingFallback,
  disclaimer,
  freshnessLabel,
}: PublicAtmosphereCardProps): ReactElement | null {
  if (!atmosphere.available || atmosphere.statusKey === null) {
    return null;
  }

  const heading = atmosphere.heading ?? headingFallback;
  const variant = atmosphereBadgeVariant(atmosphere.statusKey);
  const compact = atmosphere.presentation === "compact";
  const badgeOnly = atmosphere.presentation === "badge";

  return (
    <Card
      data-testid="public-atmosphere"
      data-atmosphere-status={atmosphere.statusKey}
      className={cn(compact || badgeOnly ? "py-0" : null)}
    >
      <CardHeader className={cn(compact || badgeOnly ? "p-3" : null)}>
        <CardTitle className="text-base">{heading}</CardTitle>
        {badgeOnly ? null : <CardDescription>{disclaimer}</CardDescription>}
      </CardHeader>
      <CardContent
        className={cn(
          "flex flex-wrap items-center gap-2",
          compact || badgeOnly ? "p-3 pt-0" : null,
        )}
      >
        <Badge variant={variant}>{statusLabel}</Badge>
        {atmosphere.freshness === "current" ? (
          <p className="w-full text-xs text-muted-foreground">
            {freshnessLabel}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
