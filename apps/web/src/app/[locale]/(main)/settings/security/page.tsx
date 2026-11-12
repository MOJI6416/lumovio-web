import { getTranslations } from "next-intl/server";
import { AdultOnly } from "@/components/profiles/AdultOnly";
import { SecuritySettings } from "@/components/settings/SecuritySettings";

/** The tab names the section; the settings layout adds "· Settings · Lumovio". */
export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("security") };
}

export default function Page() {
  return (
    <AdultOnly from="/settings/security">
      <SecuritySettings />
    </AdultOnly>
  );
}
