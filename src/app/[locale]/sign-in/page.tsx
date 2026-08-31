import { getTranslations } from "next-intl/server";

import { SignInForm } from "@/components/auth/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseSafeApplicationPath } from "@/core/auth/redirects";
import { resolveRequestLocale } from "@/core/i18n/server";

interface SignInPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

export default async function SignInPage({
  params,
  searchParams,
}: SignInPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const t = await getTranslations("auth");
  const query = await searchParams;
  const nextPath = parseSafeApplicationPath(query.next ?? null);

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("signInTitle")}</CardTitle>
        <CardDescription>{t("signInDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm nextPath={nextPath} />
      </CardContent>
    </Card>
  );
}
