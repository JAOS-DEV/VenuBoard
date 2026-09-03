import { notFound } from "next/navigation";

import { UiGallery } from "@/components/dev/ui-gallery";
import { isOrdinaryLocalDevelopment } from "@/core/dev/guard";
import { serverEnv } from "@/core/env/server";
import { resolveRequestLocale } from "@/core/i18n/server";

export const dynamic = "force-dynamic";

interface UiGalleryPageProps {
  params: Promise<{ locale: string }>;
}

export default async function UiGalleryPage({
  params,
}: UiGalleryPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);

  if (
    !isOrdinaryLocalDevelopment(serverEnv.VENUBOARD_ENV, process.env.NODE_ENV)
  ) {
    notFound();
  }

  return <UiGallery />;
}
