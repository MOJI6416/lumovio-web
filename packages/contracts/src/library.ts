import { z } from "zod";
import { DiscoverQuery, MediaKind, TitleId, type TitleSummary } from "./media";

export const ListVisibility = z.enum(["private", "unlisted", "public"]);
export type ListVisibility = z.infer<typeof ListVisibility>;

export const ListRole = z.enum(["owner", "editor", "viewer"]);
export type ListRole = z.infer<typeof ListRole>;

export type SystemListKind = "watchlist" | "favorites";

export interface ListSummary {
  id: string;
  kind: SystemListKind | "custom";
  name: string;
  description: string | null;
  visibility: ListVisibility;
  collaborative: boolean;
  itemCount: number;
  role: ListRole;
  cover: (string | null)[]; // up to 4 poster paths
  owner: { profileId: string; name: string; handle: string | null };
  updatedAt: string;
  /** Set when the list is kept in step with an external list. */
  source: ListSource | null;
  /** Set when the list keeps itself up to date by saved conditions (a smart list). */
  rules?: ListRulesInfo | null;
}

/** An external list a custom list follows. Its titles come in its order; people's own additions stay. */
export interface ListSource {
  provider: "mdblist";
  url: string;
  name: string;
  owner: string | null;
  /** MDBList rebuilds dynamic lists from their rules on its own schedule. */
  dynamic: boolean;
  /** Items at the source as of the last sync; Lumovio takes at most `limit` of them. */
  total: number | null;
  limit: number;
  status: "pending" | "ok" | "not_found" | "unavailable";
  lastSyncedAt: string | null;
  lastAttemptAt: string | null;
  /** Titles removed by hand that a sync doesn't put back. */
  hidden: number;
}

/** A series' status as the catalog's filter names it: TMDB's "Ended" and "Returning Series" (not "Canceled"). */
export const SeriesStatus = z.enum(["ended", "returning"]);
export type SeriesStatus = z.infer<typeof SeriesStatus>;

export interface ListItem {
  title: TitleSummary;
  /** Minutes (films) or a typical episode (series), when known. */
  runtime: number | null;
  /** A series' status from the catalog index (the library's Status filter); null for a film, another status or unknown. */
  status?: SeriesStatus | null;
  note: string | null;
  addedAt: string;
  addedBy: { profileId: string; name: string } | null;
  /** Put here by the connected source rather than by a person. */
  fromSource: boolean;
}

export interface ListDetails extends ListSummary {
  /** One page of the list's titles, in its order (`?offset=`). */
  items: ListItem[];
  /** `photo`: the member profile's photo or null, as `Profile.photo`. */
  members: { profileId: string; name: string; avatar: string; photo: string | null; role: ListRole }[];
  /** Where the next page of `items` starts (`?offset=`), or null when this page is the last. */
  nextOffset?: number | null;
}

/** Page size of `GET /api/lists/:id` and `GET /api/library/watchlist|favorites`. */
export const LIST_PAGE_SIZE = 500;

export const ListCreate = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: ListVisibility.default("private"),
  collaborative: z.boolean().default(false),
});

export const ListUpdate = ListCreate.partial();

/** An MDBList list address (`https://mdblist.com/lists/{user}/{slug}`) or its numeric id. */
export const ListSourceConnect = z.object({ url: z.string().trim().min(1).max(400) });

export interface ListSourcePreview {
  provider: "mdblist";
  url: string;
  name: string;
  owner: string | null;
  description: string | null;
  dynamic: boolean;
  total: number;
  limit: number;
  /** The first titles, in the list's order. */
  sample: { kind: "movie" | "tv"; tmdbId: number; title: string; year: number | null; posterPath: string | null }[];
  /** Set when this profile already follows the list. */
  connectedListId: string | null;
}

export const ListItemAdd = z.object({
  titleId: TitleId,
  note: z.string().max(500).nullable().optional(),
});

/** What an invitation opens, before joining (`GET /api/invites/:token`). */
export interface ListInvitePreview {
  listId: string;
  name: string;
  description: string | null;
  owner: string;
  itemCount: number;
  cover: (string | null)[];
  /** The role joining gives. */
  role: "editor" | "viewer";
  expiresAt: string;
  /** Set when this profile is already in the list. */
  memberRole: ListRole | null;
}

export const ListInviteCreate = z.object({
  role: z.enum(["editor", "viewer"]),
  /** Hours until expiry. */
  ttlHours: z.number().int().min(1).max(24 * 30).default(72),
});

/* ── Smart lists: a list kept up to date by saved conditions ── */

/** Smart lists one profile may keep. */
export const MAX_RULE_LISTS = 20;
/** A smart list takes at most this many titles from the catalog (manual additions come on top). */
export const RULES_CATALOG_LIMIT = 100;

/** The catalog part of a smart list: a catalog grid's query (`DiscoverQuery`) without its page. */
export const CatalogRulesQuery = DiscoverQuery.pick({
  kind: true,
  sort: true,
  imdbVotesMax: true,
  opinions: true,
  mood: true,
  genres: true,
  withoutGenres: true,
  yearFrom: true,
  yearTo: true,
  ratingMin: true,
  votesMin: true,
  votesMax: true,
  language: true,
  anime: true,
  withoutKeywords: true,
  runtimeMax: true,
  tvType: true,
  tvStatus: true,
  episodesMax: true,
});
export type CatalogRulesQuery = z.infer<typeof CatalogRulesQuery>;

/** The profile's own lists a library smart list is gathered from. */
export const LibraryRulesList = z.enum(["watchlist", "favorites"]);
export type LibraryRulesList = z.infer<typeof LibraryRulesList>;

/**
 * A smart list's conditions. "catalog": the first `RULES_CATALOG_LIMIT` titles of the catalog by the grid's filters and
 * sort, brought up to date once a day. "library": the titles of the profile's own Watchlist / Favourites by type and
 * length, gathered whenever the list is read. `onServers` and `unwatched` are personal: they apply to the owner only and
 * are never shown to anyone else (other people get them as false).
 */
export const ListRules = z.discriminatedUnion("from", [
  z.object({
    from: z.literal("catalog"),
    query: CatalogRulesQuery,
    onServers: z.boolean().default(false),
    unwatched: z.boolean().default(false),
  }),
  z.object({
    from: z.literal("library"),
    lists: z.array(LibraryRulesList).min(1).max(2),
    show: MediaKind.nullable().default(null),
    /** Minutes (a series: its episode's); titles of unknown length are left out. */
    max: z.number().int().min(1).max(1000).nullable().default(null),
    /** Series by status (only series; one of unknown status is left out). */
    status: SeriesStatus.nullable().default(null),
    onServers: z.boolean().default(false),
    unwatched: z.boolean().default(false),
  }),
]);
export type ListRules = z.infer<typeof ListRules>;

/** What a list's page says about its conditions. */
export interface ListRulesInfo {
  /** The conditions as this reader may see them: someone else than the owner gets no personal ones. */
  rules: ListRules;
  /** "pending" — not filled yet; "unavailable" — the catalog didn't answer at the last update. */
  status: "pending" | "ok" | "unavailable";
  /** Catalog: how many titles the conditions matched at the last update, when the catalog says; null otherwise. */
  total: number | null;
  /** Catalog: at most this many of them are taken; null for a library list. */
  limit: number | null;
  /** Catalog: when the list was last brought up to date (once a day); null for a library list (it is gathered when read). */
  checkedAt: string | null;
  /** Titles removed by hand that the conditions don't bring back (for members who can edit; 0 for others). */
  hidden: number;
}

/** `POST /api/lists/rules`: a new private smart list. */
export const ListRulesCreate = z.object({
  name: z.string().trim().min(1).max(80),
  rules: ListRules,
});

/** `PUT /api/lists/:id/rules`: the owner changes a smart list's conditions ("Edit conditions"). */
export const ListRulesUpdate = z.object({ rules: ListRules });

/** `POST /api/lists/:id/copy`: the titles a smart list shows now, as a new ordinary list. */
export const ListCopy = z.object({ name: z.string().trim().min(1).max(80) });

/** Membership of one title in the active profile's library — drives card badges and buttons. */
export interface TitleLibraryState {
  titleId: TitleId;
  inWatchlist: boolean;
  isFavorite: boolean;
  rating: number | null;
  listIds: string[];
  progress: PlaybackProgress | null;
  watchedCount: number;
  lastWatchedAt: string | null;
  /** For shows: watched episode keys `s1e3`. */
  watchedEpisodes: string[];
  /** What the profile told recommendations: liked in the starter, "not interested", or "don't use for recommendations". */
  feedback: "like" | "hide" | "ignore" | null;
}

export const Rating = z.object({
  titleId: TitleId,
  value: z.number().int().min(1).max(10).nullable(),
});

export interface PlaybackProgress {
  titleId: TitleId;
  season: number | null;
  episode: number | null;
  positionSec: number;
  durationSec: number | null;
  /** 0..1, null if duration unknown. */
  fraction: number | null;
  completed: boolean;
  updatedAt: string;
  source: string;
}

/**
 * Progress beacon from a player. `seq` is monotonic per playback session so late/duplicate
 * packets from flaky networks never move the stored position backwards.
 */
export const ProgressReport = z.object({
  titleId: TitleId,
  season: z.number().int().min(0).nullable().default(null),
  episode: z.number().int().min(0).nullable().default(null),
  positionSec: z.number().min(0).max(60 * 60 * 24),
  durationSec: z.number().min(0).max(60 * 60 * 24).nullable(),
  event: z.enum(["start", "progress", "pause", "stop", "complete"]),
  playbackSessionId: z.string().min(8).max(64),
  seq: z.number().int().min(0),
  source: z.string().max(40),
  /** Client wall clock at the moment of the event, ms since epoch. */
  clientTime: z.number().int(),
});
export type ProgressReport = z.infer<typeof ProgressReport>;

export const MarkWatched = z.object({
  titleId: TitleId,
  season: z.number().int().min(0).nullable().default(null),
  episode: z.number().int().min(0).nullable().default(null),
  /**
   * Mark every aired episode in this season (or whole show when season is null); `until` — every aired episode of the
   * regular seasons up to and including `season`/`episode` ("Up to this episode").
   */
  scope: z.enum(["item", "season", "show", "until"]).default("item"),
  watchedAt: z.string().datetime().optional(),
  watched: z.boolean().default(true),
  /**
   * Chosen by the client: what this change did — the watch events it added, or the ones it removed with their own
   * dates — is kept under it for 15 minutes, so `POST /api/history/mark/undo` takes back exactly that.
   */
  undoKey: z.string().uuid().optional(),
});

/** Takes back one `MarkWatched` sent with this `undoKey`. */
export const MarkUndo = z.object({ undoKey: z.string().uuid() });

/**
 * Removes a row of the history at once — one title on one day, all its entries. What it removed is kept under
 * `undoKey` for 15 minutes, so `POST /api/history/restore` puts back exactly those rows.
 */
/**
 * Removes a history row: its entries by id and, with `span`, every other watch of that title in the row's day (the
 * profile's local day as an ISO range), so a row cut by the page boundary goes whole.
 */
export const HistoryRemove = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  undoKey: z.string().uuid(),
  span: z.object({ titleId: TitleId, from: z.string().datetime(), to: z.string().datetime() }).optional(),
});

/** Takes back one `HistoryRemove` sent with this `undoKey`. */
export const HistoryRestore = z.object({ undoKey: z.string().uuid() });

export interface HistoryEntry {
  id: string;
  title: TitleSummary;
  season: number | null;
  episode: number | null;
  episodeName: string | null;
  watchedAt: string;
  source: string;
}

export interface ContinueWatchingItem {
  title: TitleSummary;
  progress: PlaybackProgress;
  /** For shows: the next episode to play when the last one is complete. */
  next: { season: number; episode: number; name: string | null } | null;
}
