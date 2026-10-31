import type { Genre, RecommendationReason, RecommendationSeed, RecommendationShelf, TitleSummary } from "@lumovio/contracts";
import type { useTranslations } from "next-intl";
import { createElement, type ReactNode } from "react";
import { latinLang } from "@/lib/format";

/*
 * What personal shelves and their cards say about themselves (design-system 2.5, 7.12): a shelf's heading, a card's
 * one line ("Similar to «Frieren»", "Directed by …") and the lines of "Why this?" — only facts the API's reason
 * confirms (recommendations/rank.ts reasonOf). Each takes the `rows` translator.
 */

type T = ReturnType<typeof useTranslations<"rows">>;

/** Genre names by id (film and series genres of the profile's language). */
export function genreNames(genres: Genre[]): Map<number, string> {
  return new Map(genres.map((g) => [g.id, g.name.toLocaleLowerCase()]));
}

const names = (ids: number[], byId: Map<number, string>, max = 2) =>
  ids
    .map((id) => byId.get(id))
    .filter((x): x is string => Boolean(x))
    .slice(0, max)
    .join(", ");

/**
 * `text` with a person's `name` in it marked with its language when the name is in Latin letters on a page in another
 * script ("Режиссёр: <span lang="en">Michael Mann</span>", 8.11) — the API names people in the profile's language
 * when TMDB has such a name; the text as it is otherwise.
 */
export function withNameLang(text: string, name: string, locale: string): ReactNode {
  const lang = latinLang(name, locale);
  const at = lang ? text.indexOf(name) : -1;
  if (at < 0) return text;
  return [text.slice(0, at), createElement("span", { key: "n", lang }, name), text.slice(at + name.length)];
}

/** A "Because you …" heading by what the profile did with the title (HOME-16): watched, watches, rated, liked, kept. */
const BECAUSE_TITLE: Partial<Record<RecommendationSeed["signal"], "becauseWatchingTitle" | "becauseRatedTitle" | "becauseLikedTitle" | "becauseFavoriteTitle">> = {
  progress: "becauseWatchingTitle",
  rating: "becauseRatedTitle",
  like: "becauseLikedTitle",
  favorite: "becauseFavoriteTitle",
};

/** The heading of a personal shelf. */
export function shelfTitle(t: T, s: RecommendationShelf): string {
  if (s.kind === "because" && s.seed) return t(BECAUSE_TITLE[s.seed.signal] ?? "becauseTitle", { title: s.seed.title });
  if (s.kind === "person" && s.person) return t(s.person.role === "director" ? "personDirector" : s.person.role === "creator" ? "personCreator" : "personCast", { name: s.person.name });
  if (s.kind === "franchise") return t("franchiseTitle");
  if (s.kind === "fresh") return t("freshTitle");
  return t("forYou");
}

/** What a personal shelf is, for its "i". */
export function shelfNote(t: T, s: RecommendationShelf, byId: Map<number, string>): string {
  if (s.kind === "because" && s.seed) return t("becauseNote", { title: s.seed.title });
  if (s.kind === "person") return t("personNote");
  if (s.kind === "franchise") return t("franchiseNote");
  if (s.kind === "fresh") {
    const g = names(s.genres ?? [], byId);
    return g ? t("freshNote", { genres: g }) : t("freshNoteAny");
  }
  return t("forYouNote");
}

/**
 * A "For you" card's one line: where it comes from. A genre is said one way, "Your genre: drama", whether a genre the
 * profile picked or its taste led there; a new title says it is new, "New in drama" (HOME-17).
 */
export function reasonLine(t: T, r: RecommendationReason, byId: Map<number, string>): string {
  // One line under the card: one genre.
  const genres = names(r.sharedGenres, byId, 1);
  switch (r.source) {
    case "because":
      return r.seed ? t("forYouBecause", { title: r.seed.title }) : t("reasonTaste");
    case "cowatch":
      return r.seed ? t("reasonCowatch", { title: r.seed.title }) : t("reasonTaste");
    case "franchise":
      return r.seed ? t("reasonFranchise", { title: r.seed.title }) : t("franchiseTitle");
    case "person":
      return r.person
        ? t(r.person.role === "director" ? "personDirector" : r.person.role === "creator" ? "personCreator" : "personCast", { name: r.person.name })
        : t("reasonTaste");
    case "fresh":
      return genres ? t("reasonFreshGenre", { genres }) : t("reasonFresh");
    case "server":
      return t("onServer");
    case "genre":
      return genres ? t("reasonGenre", { genres }) : t("reasonTaste");
    case "explore":
      return t("reasonExplore");
    case "trending":
      return t("reasonTrending");
    default:
      return genres ? t("reasonGenre", { genres }) : t("reasonTaste");
  }
}

function signalOf(t: T, s: RecommendationSeed): string {
  switch (s.signal) {
    case "favorite":
      return t("whySignalFavorite");
    case "rating":
      return t("whySignalRating", { rating: s.rating ?? 0 });
    case "like":
      return t("whySignalLike");
    case "rewatched":
      return t("whySignalRewatched");
    case "progress":
      return t("whySignalProgress");
    case "watchlist":
      return t("whySignalWatchlist");
    case "follow":
      return t("whySignalFollow");
    default:
      return t("whySignalWatched");
  }
}

/** The lines of "Why this?" for a card: every fact its reason holds, most specific first. */
export function whyLines(t: T, title: TitleSummary, r: RecommendationReason, byId: Map<number, string>): string[] {
  const lines: string[] = [];
  const has = (s: RecommendationReason["source"]) => r.source === s || r.sources.includes(s);
  if (r.seed && (has("because") || has("cowatch") || has("franchise"))) {
    if (has("franchise")) lines.push(t("whyFranchise", { title: r.seed.title, signal: signalOf(t, r.seed) }));
    else if (has("because")) lines.push(t("whySeed", { title: r.seed.title, signal: signalOf(t, r.seed) }));
    if (has("cowatch")) lines.push(t("whyCowatch", { title: r.seed.title }));
  }
  if (r.alsoFrom > 0) lines.push(t("whyAlso", { count: r.alsoFrom }));
  if (r.person) {
    const key = r.person.role === "director" ? "whyPersonDirector" : r.person.role === "creator" ? "whyPersonCreator" : "whyPersonCast";
    lines.push(t(key, { name: r.person.name }));
  }
  const genres = names(r.sharedGenres, byId);
  if (genres) lines.push(t("whyGenres", { genres }));
  else if (r.source === "taste") lines.push(t("whyTaste"));
  if (r.source === "explore") lines.push(t("whyExplore"));
  if (has("fresh") || r.parts.fresh >= 0.7) lines.push(t("whyFresh"));
  if (r.parts.quality >= 0.6) lines.push(t("whyQuality"));
  if (title.onServer) lines.push(t("onServer"));
  if (r.source === "trending") lines.push(t("reasonTrending"));
  return lines;
}
