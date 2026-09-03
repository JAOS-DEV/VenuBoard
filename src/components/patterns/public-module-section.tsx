import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PublicModuleSectionProps {
  heading?: string | null;
  headingId?: string;
  children: ReactNode;
  className?: string;
}

export function PublicModuleSection({
  heading,
  headingId,
  children,
  className,
}: PublicModuleSectionProps): ReactElement {
  return (
    <section aria-labelledby={headingId} className={cn("space-y-3", className)}>
      {heading ? (
        <h2 id={headingId} className="text-lg font-semibold tracking-tight">
          {heading}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
