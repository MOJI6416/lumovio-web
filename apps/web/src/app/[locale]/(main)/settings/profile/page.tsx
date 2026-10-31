import { getTranslations } from "next-intl/server";
import { signInFirst } from "@/components/profiles/AdultOnly";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

/** The Profile section as a page of its own: the phone's list of sections leads here (10.1, SET-03). */
export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("profile") };
}

export default async function Page() {
  await signInFirst("/settings/profile");
  return <ProfileSettings />;
}
