import type { CatalogRow, PersonSummary, TitleSummary, Paged } from "@lumovio/contracts";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SearchView } from "@/components/search/SearchView";
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

/** Results for ?q= are server-rendered (shareable, crawlable); an empty search shows what's popular now. */
export default async function SearchPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const t = await getTranslations("nav");
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const [results, home] = await Promise.all([
    // Both optional: without the first answer the browser runs the search itself (and shows its own error with
    // Retry); without the popular titles the empty search just doesn't suggest any.
    q ? optional(serverApi<{ titles: Paged<TitleSummary>; people: PersonSummary[] }>(`/api/catalog/search?q=${encodeURIComponent(q)}`), null) : null,
    q ? null : optional(serverApi<{ rows: CatalogRow[] }>("/api/catalog/home"), null),
  ]);
  return (
    <div className="page-x mx-auto max-w-media pt-6 md:pt-10">
      {/* The page's one h1 (4.2, SH-12); the search field below is the visible heading of the page. */}
      <h1 className="sr-only">{t("search")}</h1>
      <Suspense>
        <SearchView initial={results ? { q, data: results } : undefined} suggestions={home?.rows[0]?.items.slice(0, 18) ?? []} />
      </Suspense>
    </div>
  );
}
