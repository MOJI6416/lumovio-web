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

/**
 * Whether an episode or season dated so (TMDB's YYYY-MM-DD) is out on the viewer's day; an undated one is not yet. The
 * day is lib/format's `localDay`, written out: this module is in every card's bundle, and that one is not (1.9 KB).
 */
export function isOut(airDate: string | null | undefined, today?: string): boolean {
  const d = new Date();
  const day = today ?? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return Boolean(airDate && airDate <= day);
}

/**
 * The episode after one by the seasons' counts — after a season's last, the next season's first (T1) — or null after
 * the last one (and in specials). TMDB counts announced episodes and seasons: whether it is out is the caller's check.
 */
export function episodeAfter(seasons: TitleDetails["seasons"], season: number, episode: number): { season: number; episode: number } | null {
  if (season === 0) return null;
  const s = seasons.find((x) => x.seasonNumber === season);
  if (s && episode < s.episodeCount) return { season, episode: episode + 1 };
  const next = seasons.filter((x) => x.seasonNumber > season && x.episodeCount > 0).sort((a, b) => a.seasonNumber - b.seasonNumber)[0];
  return next ? { season: next.seasonNumber, episode: 1 } : null;
}

/**
 * The episode "Watch" starts a series with: where the profile is, the one after the last finished, else the first. The
 * one after is taken only once it is out (P3, T1: TMDB's next episode or the next season's premiere date); until then
 * "Watch" stays on the episode finished.
 */
export function startEpisode(t: Pick<TitleDetails, "seasons" | "nextEpisode">, p: TitleLibraryState["progress"] | undefined): { season: number; episode: number } {
  if (p && resumable(p) && p.season !== null) return { season: p.season, episode: p.episode ?? 1 };
  const first = t.seasons.find((s) => s.seasonNumber > 0) ?? t.seasons[0];
  if (p?.completed && p.season !== null && p.episode !== null) {
    const next = episodeAfter(t.seasons, p.season, p.episode);
    const announced = t.nextEpisode && t.nextEpisode.seasonNumber === next?.season && t.nextEpisode.episodeNumber === next.episode ? t.nextEpisode : null;
    const out = announced
      ? isOut(announced.airDate)
      : next && (next.season === p.season || isOut(t.seasons.find((s) => s.seasonNumber === next.season)?.airDate));
    return next && out ? next : { season: p.season, episode: p.episode };
  }
  return { season: first?.seasonNumber ?? 1, episode: 1 };
}

/** Where "Watch" and "Continue" go: resume, else the next episode, else the start. */
export function watchHref(t: Pick<TitleDetails, "kind" | "tmdbId" | "seasons" | "nextEpisode">, p: TitleLibraryState["progress"] | undefined): string {
  const base = `/watch/${t.kind}/${t.tmdbId}`;
  if (t.kind === "movie") return base;
  const { season, episode } = startEpisode(t, p);
  return `${base}?s=${season}&e=${episode}`;
}

/** The sources screen for the same viewing: other copies, a new search (never an empty player, 8.2). */
export const sourcesHref = (href: string, extra = "") => `${href}${href.includes("?") ? "&" : "?"}pick=1${extra}`;

/**
 * The sections of a title's page that a link can open, each the id of its element (9, Title): the page was tabs until
 * 2026-11, and their links (`?tab=episodes` from the calendar, `#episodes` from a card's "Mark episodes", `?tab=watch`
 * from the player) land on the section of the same name.
 */
export const TITLE_SECTIONS = ["episodes", "videos", "watch", "related", "people", "details"] as const;
export type TitleSectionId = (typeof TITLE_SECTIONS)[number];

/** TMDB names a collection "Dune Collection" / "Дюна (Коллекция)" / "Дюна (Колекція)": the name alone (TTL-16). */
export function collectionName(name: string): string {
  return name.replace(/\s*[(（]?\s*(collection|коллекция|колекція|kolekcja|sammlung)\s*[)）]?\s*$/iu, "").trim() || name;
}
