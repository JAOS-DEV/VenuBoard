import { notFound } from "next/navigation";

import { DeveloperHub } from "@/components/dev/developer-hub";
import { isOrdinaryLocalDevelopment } from "@/core/dev/guard";
import {
  DEVELOPER_PERSONAS,
  toDeveloperPersonaView,
} from "@/core/dev/personas";
import { serverEnv } from "@/core/env/server";
import { resolveRequestLocale } from "@/core/i18n/server";

export const dynamic = "force-dynamic";

interface DeveloperHubPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DeveloperHubPage({
  params,
}: DeveloperHubPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);

  if (
    !isOrdinaryLocalDevelopment(serverEnv.VENUBOARD_ENV, process.env.NODE_ENV)
  ) {
    notFound();
  }

  return (
    <DeveloperHub personas={DEVELOPER_PERSONAS.map(toDeveloperPersonaView)} />
  );
}
