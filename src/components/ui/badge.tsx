import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap [&_svg]:size-3 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        present:
          "border-transparent bg-[var(--status-present)] text-[var(--status-present-foreground)]",
        notPresent:
          "border-transparent bg-[var(--status-not-present)] text-[var(--status-not-present-foreground)]",
        draft:
          "border-transparent bg-[var(--status-draft)] text-[var(--status-draft-foreground)]",
        scheduled:
          "border-transparent bg-[var(--status-scheduled)] text-[var(--status-scheduled-foreground)]",
        published:
          "border-transparent bg-[var(--status-published)] text-[var(--status-published-foreground)]",
        cancelled:
          "border-transparent bg-[var(--status-cancelled)] text-[var(--status-cancelled-foreground)]",
        archived:
          "border-transparent bg-[var(--status-archived)] text-[var(--status-archived-foreground)]",
        pending:
          "border-transparent bg-[var(--status-pending)] text-[var(--status-pending-foreground)]",
        quarantined:
          "border-transparent bg-[var(--status-quarantined)] text-[var(--status-quarantined-foreground)]",
        disabled:
          "border-transparent bg-[var(--status-disabled)] text-[var(--status-disabled-foreground)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps
  extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): ReactElement {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
