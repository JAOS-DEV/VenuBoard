import { getTranslations } from "next-intl/server";

import { UpdatePasswordForm } from "@/components/auth/invitation-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveRequestActor } from "@/core/actors/resolve";
import {
  parseSafeApplicationPath,
  signInNavigationHref,
} from "@/core/auth/redirects";
import { redirect } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";

export const dynamic = "force-dynamic";

interface UpdatePasswordPageProps {
  params: Promise<{ locale: string }>;
}

export default async function UpdatePasswordPage({
  params,
}: UpdatePasswordPageProps): Promise<React.ReactElement> {
  const locale = await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "none" });
  const t = await getTranslations("auth");

  if (actor.kind !== "authenticated") {
    redirect({
      href: signInNavigationHref(parseSafeApplicationPath("/update-password")),
      locale,
    });
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("updatePasswordTitle")}</CardTitle>
        <CardDescription>{t("updatePasswordDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <UpdatePasswordForm />
      </CardContent>
    </Card>
  );
}
