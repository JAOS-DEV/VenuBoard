import { getTranslations } from "next-intl/server";

import { SignInForm } from "@/components/auth/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isOrdinaryLocalDevelopment } from "@/core/dev/guard";
import { resolveSignInPrefill } from "@/core/dev/prefill";
import { LOCAL_MAILBOX_URL } from "@/core/dev/services";
import { serverEnv } from "@/core/env/server";
import { resolveRequestLocale } from "@/core/i18n/server";

interface SignInPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; persona?: string }>;
}

export default async function SignInPage({
  params,
  searchParams,
}: SignInPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const t = await getTranslations("auth");
  const query = await searchParams;
  const localDevelopmentAssistance = isOrdinaryLocalDevelopment(
    serverEnv.VENUBOARD_ENV,
    process.env.NODE_ENV,
  );
  const prefill = resolveSignInPrefill({
    enabled: localDevelopmentAssistance,
    personaId: query.persona,
    nextRaw: query.next ?? null,
  });

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("signInTitle")}</CardTitle>
        <CardDescription>{t("signInDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm
          nextPath={prefill.nextPath}
          initialEmail={prefill.email}
          localDevelopmentAssistance={localDevelopmentAssistance}
          mailboxUrl={LOCAL_MAILBOX_URL}
        />
      </CardContent>
    </Card>
  );
}
