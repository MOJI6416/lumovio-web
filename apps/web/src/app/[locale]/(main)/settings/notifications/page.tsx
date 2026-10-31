import { getTranslations } from "next-intl/server";
import { AdultOnly } from "@/components/profiles/AdultOnly";
import { NotificationSettings } from "@/components/settings/NotificationSettings";

/** The tab names the section (SH-12); the settings layout adds "· Settings · Lumovio". */
export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("notifications") };
}

export default function Page() {
  return (
    <AdultOnly from="/settings/notifications">
      <NotificationSettings />
    </AdultOnly>
  );
}
