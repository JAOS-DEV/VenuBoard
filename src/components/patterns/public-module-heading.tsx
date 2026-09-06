import type { ReactElement } from "react";

import {
  publicModuleHeadingIsCustom,
  resolvePublicModuleHeading,
} from "@/core/public-venue/heading";
import { cn } from "@/lib/utils";

interface PublicModuleHeadingProps {
  label: string;
  heading: string | null;
  headingId?: string;
  as?: "h1" | "h2";
}

export function PublicModuleHeading({
  label,
  heading,
  headingId,
  as = "h2",
}: PublicModuleHeadingProps): ReactElement {
  const title = resolvePublicModuleHeading(heading, label);
  const showLabel = publicModuleHeadingIsCustom(heading, label);
  const HeadingTag = as;

  return (
    <div className="min-w-0 space-y-1">
      {showLabel ? (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      ) : null}
      <HeadingTag
        id={headingId}
        className={cn(
          "font-semibold tracking-tight",
          as === "h1" ? "text-2xl" : "text-lg",
        )}
      >
        {title}
      </HeadingTag>
    </div>
  );
}
