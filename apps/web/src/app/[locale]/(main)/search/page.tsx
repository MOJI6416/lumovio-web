import type { CatalogRow, CatalogSearch, Genre } from "@lumovio/contracts";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SearchView } from "@/components/search/SearchView";
import { genreTiles, MIN_CHARS, popularOf, searchUrl } from "@/components/search/search-model";
import { capitalize } from "@/lib/format";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";

/**
 * Search results are endless thin pages and an empty search is today's popular titles: neither is indexed, the links
 * on them are followed (Search Console, 2026-10-29).
 */
export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("search"), robots: { index: false, follow: true } };
}

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * Results for ?q= are server-rendered (shareable); the start without a query — what's popular and the genre tiles —
 * comes with the page too, since clearing the field shows it. Each part is optional: without the first answer the
 * browser runs the search itself (with its own error and Retry); without the home page's shelves the start shows the
 * recent searches only.
 */
export default async function SearchPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const titles = sp.mode !== "ai" && q.length >= MIN_CHARS;
  const [results, home, movieGenres, tvGenres] = await Promise.all([
    titles ? optional(serverApi<CatalogSearch>(searchUrl(q)), null) : null,
    optional(serverApi<{ rows: CatalogRow[] }>("/api/catalog/home"), null),
    optional(serverApi<{ genres: Genre[] }>("/api/catalog/genres/movie"), { genres: [] as Genre[] }),
    optional(serverApi<{ genres: Genre[] }>("/api/catalog/genres/tv"), { genres: [] as Genre[] }),
  ]);
  const rows = home?.rows ?? [];
  const genres = Object.fromEntries([...tvGenres.genres, ...movieGenres.genres].map((g) => [g.id, capitalize(g.name, locale)]));
  return (
    <div className="page-x mx-auto max-w-media pt-6 md:pt-10">
      {/* The page's one h1 (4.2, SH-12); the search field below is the visible heading of the page. */}
      <h1 className="sr-only">{t("search")}</h1>
      <Suspense>
        <SearchView
          initial={results ? { q, data: results } : undefined}
          popular={popularOf(rows)}
          tiles={genreTiles(rows, movieGenres.genres, locale)}
          genres={genres}
        />
      </Suspense>
    </div>
  );
}
