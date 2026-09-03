import { PublicVenueShell } from "@/components/shells/public-venue-shell";
import { loadShellSession } from "@/core/shell/session";

export const dynamic = "force-dynamic";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default async function PublicLayout({
  children,
}: PublicLayoutProps): Promise<React.ReactElement> {
  const session = await loadShellSession();

  return (
    <PublicVenueShell
      environment={session.environment}
      signedIn={session.signedIn}
      developerHubEnabled={session.developerHubEnabled}
    >
      {children}
    </PublicVenueShell>
  );
}
