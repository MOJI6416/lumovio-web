import type { CatalogRow, RecommendationShelf, TitleSummary } from "@lumovio/contracts";

/*
 * A title as a card needs it: without the overview, which no card shows (7.12). A server page hands its cards these —
 * every card's props travel in the page's HTML (the RSC payload), and the cards' unused overviews were 23–30 % of the
 * compressed HTML of the home page and the Movies landing, which a slow phone downloads before the page can respond
 * (docs/qa/2026-10-29/perf-after.md). The billboard keeps its titles' overviews: it shows them.
 */
export const forCard = (t: TitleSummary): TitleSummary => (t.overview === null ? t : { ...t, overview: null });

export const cardRow = (r: CatalogRow): CatalogRow => ({ ...r, items: r.items.map(forCard) });

export const cardShelf = (s: RecommendationShelf): RecommendationShelf => ({ ...s, items: s.items.map((i) => ({ ...i, title: forCard(i.title) })) });
