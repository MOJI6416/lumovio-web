import { getTranslations } from "next-intl/server";
import { AdultOnly } from "@/components/profiles/AdultOnly";
import { PrivacySettings } from "@/components/settings/PrivacySettings";

/** The tab names the section; the settings layout adds "· Settings · Lumovio". */
export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("privacy") };
}

export default function Page() {
  return (
    <AdultOnly from="/settings/privacy">
      <PrivacySettings />
    </AdultOnly>
  );
}
