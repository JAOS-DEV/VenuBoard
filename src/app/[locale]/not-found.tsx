import { getTranslations } from "next-intl/server";

import { AppShell } from "@/components/app-shell";
import { NotImplementedNotice } from "@/components/not-implemented-notice";
import { loadShellSession } from "@/core/shell/session";

export default async function LocaleNotFound(): Promise<React.ReactElement> {
  const t = await getTranslations("notFound");
  const session = await loadShellSession();

  return (
    <AppShell
      environment={session.environment}
      signedIn={session.signedIn}
      developerHubEnabled={session.developerHubEnabled}
    >
      <NotImplementedNotice heading={t("title")} body={t("description")} />
    </AppShell>
  );
}
