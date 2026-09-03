"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { signOut } from "@/core/auth/actions";
import { Button } from "@/components/ui/button";

interface SignOutButtonProps {
  compact?: boolean;
}

export function SignOutButton({
  compact = false,
}: SignOutButtonProps): React.ReactElement {
  const t = useTranslations("auth");

  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        aria-label={t("signOut")}
      >
        {compact ? <LogOut aria-hidden="true" /> : t("signOut")}
      </Button>
    </form>
  );
}
