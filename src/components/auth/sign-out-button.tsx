"use client";

import { useTranslations } from "next-intl";

import { signOut } from "@/core/auth/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton(): React.ReactElement {
  const t = useTranslations("auth");

  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        {t("signOut")}
      </Button>
    </form>
  );
}
