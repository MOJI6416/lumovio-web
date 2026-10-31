import { getTranslations } from "next-intl/server";
import { AdultOnly } from "@/components/profiles/AdultOnly";
import { DevicesSettings } from "@/components/settings/DevicesSettings";

/** The tab names the section (SH-12); the settings layout adds "· Settings · Lumovio". */
export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("devices") };
}

export default function Page() {
  return (
    <AdultOnly from="/settings/devices">
      <DevicesSettings />
    </AdultOnly>
  );
}
