import { getTranslations } from "next-intl/server";
import { SearchScreen } from "@/components/tvui/screens/SearchScreen";

export async function generateMetadata() {
  const t = await getTranslations("search");
  return { robots: { index: false }, title: t("label") };
}

/** Search on a TV (S05 TV; TV document §4 "Поиск"): the query in the address, so Back comes back to the results. */
export default async function TvSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q;
  return <SearchScreen initialQuery={typeof q === "string" ? q.slice(0, 100) : ""} />;
}
