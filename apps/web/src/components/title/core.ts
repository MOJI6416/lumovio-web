import type { TitleDetails, TitleLibraryState, TitleSummary, Video } from "@lumovio/contracts";

/*
 * What the title page's client parts need of a title, cut from TitleDetails on the server (a plain module, so both
 * sides use it): the hero's actions and the tabs get this instead of the whole details (cast, crew, related…), which
 * would otherwise be sent to the browser once more for every part.
 */

export type TitleCore = TitleSummary &
  Pick<TitleDetails, "seasons" | "status" | "watchProviders" | "nextEpisode"> & {
    /** The trailer the hero's "Trailer" plays. */
    trailer: Video | null;
  };

const OUT_STATUSES = new Set(["Returning Series", "In Production", "Planned", "Pilot"]);

export function titleCore(d: TitleDetails, lang: string): TitleCore {
  return {
    id: d.id,
    kind: d.kind,
    tmdbId: d.tmdbId,
    title: d.title,
    originalTitle: d.originalTitle,
    year: d.year,
    releaseDate: d.releaseDate,
    posterPath: d.posterPath,
    backdropPath: d.backdropPath,
    overview: null,
    tmdbRating: d.tmdbRating,
    tmdbVotes: d.tmdbVotes,
    genreIds: d.genreIds,
    originalLanguage: d.originalLanguage,
    isAnime: d.isAnime,
    seasons: d.seasons,
    status: d.status,
    watchProviders: d.watchProviders,
    nextEpisode: d.nextEpisode,
    trailer: pickTrailer(d.videos, lang),
  };
}

/** A series that still gets new episodes: following it can say something (TTL-20). */
export const isOngoing = (t: Pick<TitleDetails, "kind" | "status" | "nextEpisode">) =>
  t.kind === "tv" && (Boolean(t.nextEpisode) || (t.status !== null && OUT_STATUSES.has(t.status)));

/** The trailer for the main action: an official one in the UI language, else any trailer, else a teaser. */
export function pickTrailer(videos: Video[], lang: string): Video | null {
  const rank = (v: Video) => (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 2 : 4) + (v.language === lang ? 0 : 1) - (v.official ? 0.5 : 0);
  const candidates = videos.filter((v) => v.type === "Trailer" || v.type === "Teaser");
  return candidates.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** Resume is offered past the first half-minute of something not finished. */
export function resumable(p: TitleLibraryState["progress"] | undefined): p is NonNullable<TitleLibraryState["progress"]> {
  return Boolean(p && !p.completed && p.positionSec > 30);
}

/** The episode "Watch" starts a series with: where the profile is, the one after the last finished, else the first. */
export function startEpisode(t: Pick<TitleDetails, "seasons">, p: TitleLibraryState["progress"] | undefined): { season: number; episode: number } {
  if (p && resumable(p) && p.season !== null) return { season: p.season, episode: p.episode ?? 1 };
  const first = t.seasons.find((s) => s.seasonNumber > 0) ?? t.seasons[0];
  if (p?.completed && p.season !== null && p.episode !== null) return { season: p.season, episode: p.episode + 1 };
  return { season: first?.seasonNumber ?? 1, episode: 1 };
}

/** Where "Watch" and "Continue" go: resume, else the next episode, else the start. */
export function watchHref(t: Pick<TitleDetails, "kind" | "tmdbId" | "seasons">, p: TitleLibraryState["progress"] | undefined): string {
  const base = `/watch/${t.kind}/${t.tmdbId}`;
  if (t.kind === "movie") return base;
  const { season, episode } = startEpisode(t, p);
  return `${base}?s=${season}&e=${episode}`;
}

/** The sources screen for the same viewing: other copies, a new search (never an empty player, 8.2). */
export const sourcesHref = (href: string, extra = "") => `${href}${href.includes("?") ? "&" : "?"}pick=1${extra}`;

/** The tabs of a title, in the address as `?tab=` (7.5, 8.7). */
export const TITLE_TABS = ["episodes", "watch", "related", "videos", "details"] as const;
export type TitleTabId = (typeof TITLE_TABS)[number];

/** TMDB names a collection "Dune Collection" / "Дюна (Коллекция)" / "Дюна (Колекція)": the name alone (TTL-16). */
export function collectionName(name: string): string {
  return name.replace(/\s*[(（]?\s*(collection|коллекция|колекція|kolekcja|sammlung)\s*[)）]?\s*$/iu, "").trim() || name;
}
