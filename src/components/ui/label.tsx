import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: ComponentProps<"label">): ReactElement {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
