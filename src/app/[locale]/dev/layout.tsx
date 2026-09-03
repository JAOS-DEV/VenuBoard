import { notFound } from "next/navigation";

import { DeveloperShell } from "@/components/shells/developer-shell";
import { isOrdinaryLocalDevelopment } from "@/core/dev/guard";
import { serverEnv } from "@/core/env/server";
import { loadShellSession } from "@/core/shell/session";

export const dynamic = "force-dynamic";

interface DevLayoutProps {
  children: React.ReactNode;
}

export default async function DevLayout({
  children,
}: DevLayoutProps): Promise<React.ReactElement> {
  if (
    !isOrdinaryLocalDevelopment(serverEnv.VENUBOARD_ENV, process.env.NODE_ENV)
  ) {
    notFound();
  }

  const session = await loadShellSession();

  return (
    <DeveloperShell
      environment={session.environment}
      signedIn={session.signedIn}
      developerHubEnabled={session.developerHubEnabled}
    >
      {children}
    </DeveloperShell>
  );
}
