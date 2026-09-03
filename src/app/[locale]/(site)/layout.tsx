import { AppShell } from "@/components/app-shell";
import { loadShellSession } from "@/core/shell/session";

export const dynamic = "force-dynamic";

interface SiteLayoutProps {
  children: React.ReactNode;
}

export default async function SiteLayout({
  children,
}: SiteLayoutProps): Promise<React.ReactElement> {
  const session = await loadShellSession();

  return (
    <AppShell
      environment={session.environment}
      signedIn={session.signedIn}
      developerHubEnabled={session.developerHubEnabled}
    >
      {children}
    </AppShell>
  );
}
