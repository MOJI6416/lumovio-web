import { getTranslations } from "next-intl/server";
import { signInFirst } from "@/components/profiles/AdultOnly";
import { DevicesSettings } from "@/components/settings/DevicesSettings";

/** The tab names the section; the settings layout adds "· Settings · Lumovio". */
export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("thisDevice") };
}

/** This device: the browser's own settings — a kids profile has them too. */
export default async function Page() {
  await signInFirst("/settings/devices");
  return <DevicesSettings />;
}
