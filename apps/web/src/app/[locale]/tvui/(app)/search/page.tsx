import type { CatalogRow, Genre } from "@lumovio/contracts";
import { getLocale, getTranslations } from "next-intl/server";
import { genreTiles, popularOf } from "@/components/search/search-model";
import { trimOverview } from "@/components/tvui/media/types";
import { SearchScreen } from "@/components/tvui/screens/SearchScreen";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("search");
  return { robots: { index: false }, title: t("label") };
}

/**
 * Search on a TV (S05 TV; TV document §4 "Поиск"; design-system 9 "Search"): the query and the type in the address, so
 * Back comes back to the results; the start without a query — what's popular and the genre tiles — comes with the page.
 */
export default async function TvSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const locale = await getLocale();
  const [home, genres] = await Promise.all([
    optional(serverApi<{ rows: CatalogRow[] }>("/api/catalog/home"), null),
    optional(serverApi<{ genres: Genre[] }>("/api/catalog/genres/movie"), { genres: [] as Genre[] }),
  ]);
  const rows = home?.rows ?? [];
  return (
    <SearchScreen
      initialQuery={typeof q === "string" ? q.slice(0, 100) : ""}
      popular={popularOf(rows).map(trimOverview)}
      tiles={genreTiles(rows, genres.genres, locale)}
    />
  );
}
