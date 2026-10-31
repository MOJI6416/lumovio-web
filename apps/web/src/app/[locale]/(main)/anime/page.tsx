import type { Genre, Paged, TitleSummary } from "@lumovio/contracts";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AnimeOff } from "@/components/browse/AnimeOff";
import { BrowseView } from "@/components/browse/BrowseView";
import { SectionLanding } from "@/components/browse/SectionLanding";
import { shelfHeading } from "@/components/media/shelf-copy";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "@/i18n/navigation";
import { browseState, discoverQuery, wantsGrid } from "@/lib/discover";
import { ANIME_GENRES, ANIME_MOVIE_GENRES } from "@/lib/anime-genres";
import { optional } from "@/lib/optional";
import { pageSeo } from "@/lib/seo";
import { getMe, serverApi } from "@/lib/server-api";
import { showsAnime } from "@/lib/show-anime";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations("browse");
  // Filters in the address are views of the section: the canonical is the section itself (SH-13).
  return { title: t("titleAnime"), ...pageSeo((await params).locale, "/anime") };
}

/** Anime is a facet over TMDB movies/series (animation + Japanese origin), with its own section. */
export default async function AnimePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("browse");
  const tr = await getTranslations();
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  // The profile has anime off (8.14): the section says so, with the way to turn it on.
  if (!showsAnime(await optional(getMe(), null))) {
    return (
      <div className="page-x mx-auto max-w-media">
        <PageHeader title={t("titleAnime")} />
        <AnimeOff />
      </div>
    );
  }
  const { genres } = await serverApi<{ genres: Genre[] }>("/api/catalog/genres/tv").catch(() => ({ genres: [] as Genre[] }));
  const animeGenres = genres.filter((g) => ANIME_GENRES.has(g.id));

  if (!wantsGrid(get)) {
    return <SectionLanding kind="tv" anime title={t("titleAnime")} allLabel={t("allAnime")} base="/anime" genres={animeGenres} watchNow={get("watch") === "now"} />;
  }

  const kind = get("kind") === "movie" ? "movie" : "tv";
  // Films take the movie taxonomy; a genre that exists only in the other one (left over from switching
  // between series and films) would silently empty the grid, so it is dropped from the address.
  const movieGenres =
    kind === "movie" ? (await serverApi<{ genres: Genre[] }>("/api/catalog/genres/movie").catch(() => ({ genres: [] as Genre[] }))).genres : [];
  const known = kind === "movie" ? movieGenres : genres;
  const picked = (get("genres") ?? "").split(",").filter(Boolean);
  const kept = picked.filter((id) => known.some((g) => String(g.id) === id));
  if (known.length > 0 && kept.length < picked.length) {
    const next = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    if (kept.length) next.set("genres", kept.join(","));
    else next.delete("genres");
    redirect({ href: `/anime?${next}`, locale });
  }
  const gridGenres = kind === "movie" ? movieGenres.filter((g) => ANIME_MOVIE_GENRES.has(g.id)) : animeGenres;
  const query = discoverQuery(kind, browseState(get, true));
  // The first page rendered on the server; without it the browser loads it (with its own error and Retry).
  const first = await optional(serverApi<Paged<TitleSummary>>(`/api/catalog/discover?${query}&page=1`), null);
  // A shelf's "All" page keeps its name and what it is for (CAT-05, CAT-11).
  const shelf = shelfHeading(get("shelf"), (k) => tr(k as "rows.finishedAnime"), gridGenres, locale);
  return (
    <div className="page-x mx-auto max-w-media">
      <PageHeader back={{ href: "/anime", label: t("titleAnime") }} title={shelf?.title ?? t("allAnime")} description={shelf?.description} />
      <Suspense>
        <BrowseView kind="tv" genres={gridGenres} anime allowKindSwitch initial={first ? { query, page: first } : undefined} />
      </Suspense>
    </div>
  );
}
