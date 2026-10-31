import { getTranslations } from "next-intl/server";
import { signInFirst } from "@/components/profiles/AdultOnly";
import { RecommendationSettings } from "@/components/settings/RecommendationSettings";

export async function generateMetadata() {
  const t = await getTranslations("recs");
  return { title: t("title") };
}

/** The genres load in their own section, with an error and "Retry" there instead of an empty list (SET-12). */
export default async function Page() {
  await signInFirst("/settings/recommendations");
  return <RecommendationSettings />;
}
