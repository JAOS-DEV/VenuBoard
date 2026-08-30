import { getTranslations } from "next-intl/server";

import { NotImplementedNotice } from "@/components/not-implemented-notice";
import { resolveRequestLocale } from "@/core/i18n/server";

/**
 * Venue administration shell.
 *
 * Authentication, membership loading, active-venue selection and
 * entitlement-driven navigation are all later phases. Nothing here reads the
 * database.
 */
interface AdminPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminPage({
  params,
}: AdminPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);

  const t = await getTranslations("admin");
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
