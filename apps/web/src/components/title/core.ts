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

/** A series that still gets new episodes: following it can say something. */
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

/**
 * The episode "Watch" starts a series with: where the profile is, the one after the last finished (the next season's
 * first after a season's last), else the first. `chosen`: a season picked in the title's "Episodes" — its first episode,
 * unless the profile is in that season (without it: "changed the season, pressed Watch — the old one
 * started").
 */
export function startEpisode(t: Pick<TitleDetails, "seasons">, p: TitleLibraryState["progress"] | undefined, chosen: number | null = null): { season: number; episode: number } {
  const own = ((): { season: number; episode: number } => {
    if (p && resumable(p) && p.season !== null) return { season: p.season, episode: p.episode ?? 1 };
    const first = t.seasons.find((s) => s.seasonNumber > 0) ?? t.seasons[0];
    if (p?.completed && p.season !== null && p.episode !== null) {
      const count = t.seasons.find((s) => s.seasonNumber === p.season)?.episodeCount ?? 0;
      const next = t.seasons.find((s) => s.seasonNumber === p.season! + 1);
      if (count > 0 && p.episode >= count && next) return { season: next.seasonNumber, episode: 1 };
      return { season: p.season, episode: p.episode + 1 };
    }
    return { season: first?.seasonNumber ?? 1, episode: 1 };
  })();
  return chosen === null || chosen === own.season || !t.seasons.some((s) => s.seasonNumber === chosen) ? own : { season: chosen, episode: 1 };
}

/** Where "Watch" and "Continue" go: resume, else the next episode, else the start (`chosen`: see `startEpisode`). */
export function watchHref(t: Pick<TitleDetails, "kind" | "tmdbId" | "seasons">, p: TitleLibraryState["progress"] | undefined, chosen: number | null = null): string {
  const base = `/watch/${t.kind}/${t.tmdbId}`;
  if (t.kind === "movie") return base;
  const { season, episode } = startEpisode(t, p, chosen);
  return `${base}?s=${season}&e=${episode}`;
}

/** The sources screen for the same viewing: other copies, a new search (never an empty player). */
export const sourcesHref = (href: string, extra = "") => `${href}${href.includes("?") ? "&" : "?"}pick=1${extra}`;

/**
 * The sections of a title's page that a link can open, each the id of its element: older versions had tabs,
 * and their links (`?tab=episodes` from the calendar, `#episodes` from a card's "Mark episodes", `?tab=watch`
 * from the player) land on the section of the same name.
 */
export const TITLE_SECTIONS = ["episodes", "videos", "watch", "related", "people", "details"] as const;
export type TitleSectionId = (typeof TITLE_SECTIONS)[number];

/** TMDB names a collection "Dune Collection" / "Дюна (Коллекция)" / "Дюна (Колекція)": the name alone. */
export function collectionName(name: string): string {
  return name.replace(/\s*[(（]?\s*(collection|коллекция|колекція|kolekcja|sammlung)\s*[)）]?\s*$/iu, "").trim() || name;
}
