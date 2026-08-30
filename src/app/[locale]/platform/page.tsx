import { getTranslations } from "next-intl/server";

import { NotImplementedNotice } from "@/components/not-implemented-notice";
import { resolveRequestLocale } from "@/core/i18n/server";

/**
 * Platform administration shell.
 *
 * Platform authentication, the mandatory multi-factor requirement, audited
 * support sessions and operator-led tenant creation are all later phases.
 */
interface PlatformPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PlatformPage({
  params,
}: PlatformPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);

  const t = await getTranslations("platform");
  const tShell = await getTranslations("shell");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <NotImplementedNotice
        heading={tShell("notImplemented")}
        body={t("notImplemented")}
        note={t("scopeNote")}
      />
    </div>
  );
}
