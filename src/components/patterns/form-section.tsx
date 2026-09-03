import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps): ReactElement {
  return (
    <fieldset className={cn("space-y-3", className)}>
      <legend className="text-sm font-semibold">{title}</legend>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </fieldset>
  );
}
