import { LogIn } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Link } from "@/core/i18n/navigation";

interface AccountControlsProps {
  signedIn: boolean;
  signInLabel: string;
  compact?: boolean;
}

export function AccountControls({
  signedIn,
  signInLabel,
  compact = false,
}: AccountControlsProps): React.ReactElement {
  if (signedIn) {
    return <SignOutButton compact={compact} />;
  }

  return (
    <Button asChild variant="ghost" size={compact ? "icon" : "sm"}>
      <Link href="/sign-in" aria-label={signInLabel}>
        {compact ? <LogIn aria-hidden="true" /> : signInLabel}
      </Link>
    </Button>
  );
}
