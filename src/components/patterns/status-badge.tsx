import type { ReactElement } from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { StatusVariant } from "@/core/ui/tokens";

type StatusBadgeVariant = NonNullable<BadgeProps["variant"]>;

const TOKEN_TO_BADGE: Record<StatusVariant, StatusBadgeVariant> = {
  present: "present",
  "not-present": "notPresent",
  draft: "draft",
  scheduled: "scheduled",
  published: "published",
  cancelled: "cancelled",
  archived: "archived",
  pending: "pending",
  quarantined: "quarantined",
  disabled: "disabled",
};

interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant | StatusVariant;
}

export function StatusBadge({
  label,
  variant = "secondary",
}: StatusBadgeProps): ReactElement {
  const resolved =
    variant in TOKEN_TO_BADGE
      ? TOKEN_TO_BADGE[variant as StatusVariant]
      : (variant as StatusBadgeVariant);
  return <Badge variant={resolved}>{label}</Badge>;
}
