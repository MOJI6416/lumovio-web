import { z } from "zod";
import { TitleId, type TitleSummary } from "./media";

/**
 * What a profile told or showed about a title, as recommendations count it: favorite (in Favourites), rating (rated
 * it), like (the starter's "Like"), watched / rewatched (finished, more than once), progress (watching now), abandoned
 * (stopped early and left it), watchlist, follow (follows a series), hide ("Not interested").
 */
/** "opened": the profile stayed on the title's page (a weak signal, only while `useOpens` is on). */
export type TasteSignalKind = "favorite" | "rating" | "like" | "watched" | "rewatched" | "progress" | "abandoned" | "watchlist" | "follow" | "hide" | "opened";

/** A title of the profile's own that picks start from (the strongest signal it has). */
export interface RecommendationSeed {
  titleId: TitleId;
  title: string;
  signal: TasteSignalKind;
  rating: number | null;
}

/** Where a pick comes from — the stage of recommendations that proposed it (docs/curation.md, "For you"). */
export type RecommendationSource =
  /** Recommended for a title the profile likes (TMDB's recommendations of it, same form, shared genres). */
  | "because"
  /** Accounts that watched a title the profile likes watched this too (Lumovio's own data, 5+ accounts). */
  | "cowatch"
  /** The next part of a film series the profile watched or likes. */
  | "franchise"
  /** By a director, creator or actor of titles the profile likes. */
  | "person"
  /** Released lately in the profile's genres. */
  | "fresh"
  /** On the profile's own servers. */
  | "server"
  /** Popular now (a weak source). */
  | "trending"
  /** A small share from interests next to the profile's own, for variety. */
  | "explore"
  /** Fits the profile's interests closely (found by a weak source: popular now, quality picks). */
  | "taste"
  /** In a genre the profile picked in the starter. */
  | "genre";

export interface RecommendationPerson {
  id: number;
  name: string;
  role: "director" | "creator" | "cast";
}

/** Why a title is among the picks: only facts the profile's own data and the catalog confirm. */
export interface RecommendationReason {
  /** The source the card's line names. */
  source: RecommendationSource;
  /** The profile's title it comes from (because, cowatch, franchise). */
  seed?: RecommendationSeed;
  /** The person it comes from (person), or one the profile likes who is in it. */
  person?: RecommendationPerson;
  /** TMDB genres it shares with the profile's interests (or the seed), besides Animation; up to two. */
  sharedGenres: number[];
  /** How many other titles of the profile lead to it as well. */
  alsoFrom: number;
  /** Every source that proposed it. */
  sources: RecommendationSource[];
  /** The ranking's parts, 0–1 each (recommendations/rank.ts, WEIGHTS), for "Why this?". */
  parts: { match: number; source: number; quality: number; fresh: number; popular: number };
}

export interface Recommendation {
  title: TitleSummary;
  reason: RecommendationReason;
}

/**
 * One personal shelf. Keys are generic (for_you, franchise, because_1…3, person_1, fresh) so the anonymous discovery
 * counters never carry a title or a person.
 */
export interface RecommendationShelf {
  key: string;
  kind: "for_you" | "franchise" | "because" | "person" | "fresh";
  /** because: the profile's title the shelf is for. */
  seed?: RecommendationSeed;
  /** person: who the shelf is about. */
  person?: RecommendationPerson;
  /** fresh: the profile's genres it looked in. */
  genres?: number[];
  items: Recommendation[];
}

export interface Recommendations {
  /** personal: picks from the profile's own signals; start: nothing to start from yet. */
  state: "personal" | "start";
  /** "For you" (the first of `shelves` of kind for_you), for clients that show one shelf. */
  items: Recommendation[];
  /** Every personal shelf, in the order the home page shows them; a title is on one shelf only. */
  shelves: RecommendationShelf[];
  /** The titles the picks start from, strongest first. */
  seeds: RecommendationSeed[];
  mutedGenres: number[];
  likedGenres: number[];
  startDismissed: boolean;
}

export type RecommendationDiscovery = "proven" | "balanced" | "new";

/** A profile's recommendation settings (Settings → Recommendations). */
export interface RecommendationPrefs {
  mutedGenres: number[];
  likedGenres: number[];
  mutedPeople: { id: number; name: string }[];
  /** Watching, progress, the watchlist and follows count; off — only ratings, favourites, likes and "Not interested". */
  useHistory: boolean;
  discovery: RecommendationDiscovery;
  startDismissed: boolean;
  /** Title pages the profile stays on are recorded and count a little; off — they are neither recorded nor used. */
  useOpens: boolean;
}

/** One of the profile's titles as recommendations learn from it (Settings → "What recommendations are built on"). */
export interface TasteSignal {
  title: TitleSummary;
  signals: TasteSignalKind[];
  rating: number | null;
  /** "Not interested" with its reason. */
  hideReason: "seen" | "genre" | "title" | null;
  /** Signed influence (−3…3): above zero pulls titles like it up, below zero pushes them down. */
  weight: number;
  /** "Don't use for recommendations": the title's signals are kept but teach nothing. */
  ignored: boolean;
  /** The latest of its signals (ISO). */
  at: string;
}

/** What the profile's signals add up to, strongest first; shares are 0–1 of the positive weight. */
export interface TasteInterests {
  genres: { id: number; share: number }[];
  people: (RecommendationPerson & { share: number })[];
  forms: { form: "anime" | "animation" | "live"; share: number }[];
  kinds: { kind: "movie" | "tv"; share: number }[];
  decades: { decade: number; share: number }[];
  languages: { language: string; share: number }[];
}

export interface TasteProfile {
  signals: TasteSignal[];
  interests: TasteInterests;
  prefs: RecommendationPrefs;
  /** A kids profile: titles not checked against its age limit in time were left out; asked again (PRF-19). */
  incomplete?: true;
}

export const RecommendationFeedback = z.object({
  titleId: TitleId,
  kind: z.enum(["like", "hide", "ignore"]),
  on: z.boolean(),
  /** "Not interested" only: why. */
  reason: z.enum(["seen", "genre", "title"]).optional(),
});
export type RecommendationFeedback = z.infer<typeof RecommendationFeedback>;

export const RecommendationSettingsUpdate = z.object({
  mutedGenres: z.array(z.number().int().positive()).max(40).optional(),
  likedGenres: z.array(z.number().int().positive()).max(40).optional(),
  mutedPeople: z.array(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(120) })).max(50).optional(),
  useHistory: z.boolean().optional(),
  discovery: z.enum(["proven", "balanced", "new"]).optional(),
  startDismissed: z.boolean().optional(),
  useOpens: z.boolean().optional(),
});
export type RecommendationSettingsUpdate = z.infer<typeof RecommendationSettingsUpdate>;

/** `POST /api/recommendations/opened`: the profile stayed on this title's page. */
export const TitleOpened = z.object({ titleId: TitleId });
export type TitleOpened = z.infer<typeof TitleOpened>;

/**
 * Discovery counters sent by the page (C5): what a shelf card did, with its page, shelf and position.
 * Nothing identifies the profile or the title.
 */
export const DiscoveryEvents = z.object({
  events: z
    .array(
      z.object({
        page: z.string().regex(/^[a-z_]{1,24}$/),
        shelf: z.string().regex(/^[a-z0-9_]{1,40}$/),
        slot: z.number().int().min(0).max(59),
        onServer: z.boolean(),
        event: z.enum(["impression", "open", "watchlist", "play"]),
      }),
    )
    .min(1)
    .max(200),
});
export type DiscoveryEvent = z.infer<typeof DiscoveryEvents>["events"][number];
