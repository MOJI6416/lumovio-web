import { z } from "zod";
import { type Genre, MediaKind, type TitleSummary } from "./media";

/** A person the request names: a director's films, an actor's roles, or either. */
export const AiPerson = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.enum(["director", "actor", "any"]),
});
export type AiPerson = z.infer<typeof AiPerson>;

/**
 * The conditions an AI search actually applies. The UI shows and edits exactly these, so the
 * "understood as" line never claims more than the search does. Every field except `keywords`,
 * `similarTo`, `preferShort` and `sort` is a hard limit, enforced on every result — including
 * keyword fallbacks and recommendations for referenced titles.
 */
export const AiFilters = z.object({
  kind: MediaKind,
  /** All of these genres (TMDB ids). */
  genres: z.array(z.number().int().positive()).max(3),
  /** At least one of these genres — how a mood ("cozy") is approximated. */
  anyGenres: z.array(z.number().int().positive()).max(5),
  /** None of these genres. */
  excludeGenres: z.array(z.number().int().positive()).max(8),
  yearFrom: z.number().int().min(1880).max(2100).nullable(),
  yearTo: z.number().int().min(1880).max(2100).nullable(),
  /** TMDB score, 0–9. */
  ratingMin: z.number().min(0).max(9).nullable(),
  /** ISO 639-1 original language. */
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .nullable(),
  /** Minutes: the film's runtime, or a typical episode for series. Unknown runtime does not match. */
  runtimeMax: z.number().int().min(1).max(600).nullable(),
  anime: z.boolean(),
  /** Soft: English TMDB keywords that narrow the first pass; dropped when they find too little. */
  keywords: z.array(z.string().trim().min(1).max(40)).max(3),
  /** Soft: titles the user referenced; their recommendations are added if they pass every limit. */
  similarTo: z.array(z.string().trim().min(1).max(120)).max(2),
  /** Soft: "preferably short" — orders known short titles first, filters nothing. */
  preferShort: z.boolean(),
  sort: z.enum(["popularity", "rating", "release_desc"]),
  /**
   * Series only, the catalog's own filters (DiscoverQuery `tvType`, `tvStatus`; SRCH-01): "mini" — a miniseries,
   * "scripted" — scripted shows and miniseries; "ended" — the story is finished, "returning" — still going on.
   */
  tvType: z.enum(["scripted", "mini"]).nullable().default(null),
  tvStatus: z.enum(["ended", "returning"]).nullable().default(null),
  /** Hard: every result is from these people's work — a director's films, an actor's roles (Lumovio resolves the names). */
  people: z.array(AiPerson).max(2).default([]),
  /**
   * Soft, not a condition: titles the model named as fitting the whole description ("Paddington 2 (2017)"). Only those
   * found in Lumovio's catalog are shown, first, and only if they pass every limit; never shown as a chip.
   */
  examples: z.array(z.string().trim().min(1).max(140)).max(12).default([]),
});
export type AiFilters = z.infer<typeof AiFilters>;

/** Why a result was picked, said under its card: like a referenced title, a named person's work, or named as fitting. */
export type AiWhy = { kind: "like"; title: string } | { kind: "person"; name: string; role: AiPerson["role"] } | { kind: "pick" };

/** `tvType` / `tvStatus` as TMDB states them ("Miniseries", "Ended"), for the hard limits on every result. */
export type AiResultTitle = TitleSummary & { runtime: number | null; tvType?: string | null; tvStatus?: string | null; why?: AiWhy };

export interface AiSearchResponse {
  filters: AiFilters;
  /**
   * False when the text doesn't describe something to watch ("asdfgh qwerty", SRCH-02): there are no results then,
   * and the app says so instead of "Understood as: Film". Absent in answers of an older server (true).
   */
  understood?: boolean;
  /** Parts of the request matched only approximately (moods mapped to genres or keywords), as the user wrote them. */
  approximate: string[];
  /** Parts of the request no filter supports; they were not applied. */
  unsupported: string[];
  /** The keywords found too little, so titles without them were added (every hard limit still holds). */
  keywordsRelaxed: boolean;
  /** Localized names for the genre ids in `filters`. */
  genres: Genre[];
  results: AiResultTitle[];
  cached: boolean;
}
