import type { CatalogPage, Genre, MediaKind, Paged, TitleSummary } from "@lumovio/contracts";
import { getLocale, getTranslations } from "next-intl/server";
import { shelfHeading } from "@/components/media/shelf-copy";
import { browseState, discoverQuery } from "@/lib/discover";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";
import { catalogShelf } from "../media/shelves";
import { trimOverview, type TvShelfData } from "../media/types";
import { GridScreen } from "./GridScreen";
import { HeroActions } from "./HeroActions";
import { ShelvesScreen } from "./ShelvesScreen";

/*
 * Movies, Series and Anime on a TV (S02, S03 TV): the section's landing — the featured title with "More info",
 * "Watchlist", the whole list and the genres, then the section's Top 10 and shelves, as the site's landing — or, when
 * the address asks for it (filters, `view=all`), its grid (./GridScreen). Same data as the site's section pages.
 */
export async function SectionPage({
  kind,
  anime,
  base,
  title,
  allLabel,
  genres,
  movieGenres,
  grid,
  get,
}: {
  kind: MediaKind;
  anime: boolean;
  base: string;
  title: string;
  allLabel: string;
  genres: Genre[];
  movieGenres?: Genre[];
  grid: boolean;
  get: (k: string) => string | null;
}) {
  const t = await getTranslations();
  if (grid) {
    const gridKind: MediaKind = anime && get("kind") === "movie" ? "movie" : kind;
    const query = discoverQuery(gridKind, browseState(get, anime));
    const first = await optional(
      serverApi<Paged<TitleSummary>>(`/api/catalog/discover?${query}&page=1`),
      null,
    );
    // A shelf's "All" page keeps its name and what it is for (CAT-05, CAT-11).
    const shelf = shelfHeading(get("shelf"), (k) => t(k as "rows.oneEvening"), genres, await getLocale());
    return (
      <GridScreen
        kind={kind}
        anime={anime}
        genres={genres}
        movieGenres={movieGenres}
        title={shelf?.title ?? allLabel}
        description={shelf?.description}
        initial={first ? { query, page: first } : undefined}
      />
    );
  }
  const data = await serverApi<CatalogPage>(`/api/catalog/section/${kind}${anime ? "?anime=1" : ""}`);
  // The section's Top 10 (one per page) unless "watch now" thinned the list, then its shelves.
  const now = data.mode === "now";
  const [popular, ...rest] = now ? [undefined, ...data.rows] : data.rows;
  const top = popular ? catalogShelf(popular, t, true) : null;
  const shelves = [
    top && { ...top, title: t("rows.top10Section", { section: title }) },
    ...rest.map((r) => (r ? catalogShelf(r, t) : null)),
  ].filter((s): s is TvShelfData => Boolean(s));
  const hero = data.featured[0] ? trimOverview(data.featured[0]) : null;
  return (
    <ShelvesScreen
      level="section"
      heading={title}
      hero={hero}
      heroActions={
        hero ? (
          <HeroActions
            title={hero}
            all={{ label: allLabel, href: `${base}?view=all` }}
            genres={genres}
            genreBase={base}
          />
        ) : undefined
      }
      shelves={shelves}
      genres={genres}
    />
  );
}
