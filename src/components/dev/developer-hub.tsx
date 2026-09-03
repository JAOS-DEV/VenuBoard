import { DeveloperHubClient } from "@/components/dev/developer-hub-client";
import type { DeveloperPersonaView } from "@/core/dev/personas";
import { LOCAL_SERVICE_LINKS } from "@/core/dev/services";

interface DeveloperHubProps {
  personas: readonly DeveloperPersonaView[];
}

export function DeveloperHub({
  personas,
}: DeveloperHubProps): React.ReactElement {
  return (
    <DeveloperHubClient personas={personas} services={LOCAL_SERVICE_LINKS} />
  );
}
