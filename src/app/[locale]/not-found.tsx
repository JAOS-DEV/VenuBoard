import { getTranslations } from "next-intl/server";

import { NotImplementedNotice } from "@/components/not-implemented-notice";

export default async function LocaleNotFound(): Promise<React.ReactElement> {
  const t = await getTranslations("notFound");

  return <NotImplementedNotice heading={t("title")} body={t("description")} />;
}
