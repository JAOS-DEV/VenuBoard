import type { ComponentProps, ReactElement } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionCard({
  className,
  ...props
}: ComponentProps<typeof Card>): ReactElement {
  return <Card className={cn("p-4", className)} {...props} />;
}
