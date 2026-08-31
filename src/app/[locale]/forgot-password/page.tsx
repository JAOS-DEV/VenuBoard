import { getTranslations } from "next-intl/server";

import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";

interface ForgotPasswordPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ForgotPasswordPage({
  params,
}: ForgotPasswordPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const t = await getTranslations("auth");

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("forgotTitle")}</CardTitle>
        <CardDescription>{t("forgotDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ForgotPasswordForm />
        <p className="text-sm text-muted-foreground">
          <Link href="/sign-in" className="underline underline-offset-4">
            {t("backToSignIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
