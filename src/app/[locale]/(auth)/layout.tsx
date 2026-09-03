import { AuthShell } from "@/components/shells/auth-shell";
import { loadShellSession } from "@/core/shell/session";

export const dynamic = "force-dynamic";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default async function AuthLayout({
  children,
}: AuthLayoutProps): Promise<React.ReactElement> {
  const session = await loadShellSession();

  return (
    <AuthShell
      environment={session.environment}
      signedIn={session.signedIn}
      developerHubEnabled={session.developerHubEnabled}
    >
      {children}
    </AuthShell>
  );
}
