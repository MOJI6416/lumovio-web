import { z } from "zod";

/** Lumovio treats "anime" as a facet of movie/tv titles, not a separate TMDB type. */
export const MediaKind = z.enum(["movie", "tv"]);
export type MediaKind = z.infer<typeof MediaKind>;

/** Stable public identifier of a catalog title: `movie:550`, `tv:1399`. */
export const TitleId = z.string().regex(/^(movie|tv):\d+$/);
export type TitleId = z.infer<typeof TitleId>;

export function titleId(kind: MediaKind, tmdbId: number): TitleId {
  return `${kind}:${tmdbId}`;
}

export function parseTitleId(id: string): { kind: MediaKind; tmdbId: number } | null {
  const m = /^(movie|tv):(\d+)$/.exec(id);
  if (!m) return null;
  return { kind: m[1] as MediaKind, tmdbId: Number(m[2]) };
}

/** Optional episode coordinates; absent for movies and whole shows. */
export const EpisodeRef = z.object({
  season: z.number().int().min(0),
  episode: z.number().int().min(0),
});
export type EpisodeRef = z.infer<typeof EpisodeRef>;

export interface Genre {
  id: number;
  name: string;
}

export interface TitleSummary {
  id: TitleId;
  kind: MediaKind;
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  /** TMDB community score 0–10 with vote count, shown with attribution. */
  tmdbRating: number | null;
  tmdbVotes: number | null;
  genreIds: number[];
  originalLanguage: string | null;
  isAnime: boolean;
  /** IMDb weighted average 0–10 when a third-party snapshot is known (attached by the API). */
  imdbRating?: number | null;
  /** Lumovio Score for cards, only at medium or high confidence (attached by the API while the feature is on). */
  lumovioScore?: CardScore | null;
  /**
   * The score a catalog grid is sorted by (catalog index sorts): the card shows it in place of its usual one — IMDb's
   * rating 0–10, Rotten Tomatoes' Tomatometer or Metacritic's Metascore 0–100.
   */
  sortScore?: { source: "imdb" | "rotten_tomatoes" | "metacritic"; value: number } | null;
  /** Minutes, attached where a length limit chose the title (e.g. "For one evening"). */
  runtime?: number | null;
  /** Cinema release in the profile's region ("In theaters", "Coming soon") or a first digital release ("New in digital"). */
  release?: TitleRelease | null;
  /** The series fact a series or anime shelf chose the title by, shown on the card. */
  seriesFact?: SeriesFact;
  /** A copy is on the active profile's own servers, per the library index (set only when true). */
  onServer?: boolean;
  /** When a title from the profile's own lists first appeared on its servers. */
  serverEvent?: ServerEvent;
}

/** A copy arriving on the profile's servers: the indexing date (YYYY-MM-DD, UTC), not the premiere. */
export interface ServerEvent {
  kind: "added";
  date: string;
}

/**
 * A release date: theatrical in one region (`rerelease` when the film already opened there before),
 * or digital — the first digital release anywhere, `region` being the country it came out in first.
 */
export interface TitleRelease {
  date: string;
  region: string;
  rerelease: boolean;
  type: "theatrical" | "digital";
}

/**
 * Why a series is on its shelf. season: a season 2+ that premiered recently, `aired` episodes out so
 * far, `complete` once its finale has aired. premiere: a new series' first air date. airing: the next
 * announced episode's date and the last aired one's. length: the whole series as TMDB lists it.
 */
export type SeriesFact =
  | { kind: "season"; season: number; premiere: string; aired: number; complete: boolean }
  | { kind: "premiere"; date: string }
  /** `episode`: the dated one (the next when announced) where its number is the releases' (catalog/curation `releaseNumbered`). */
  | { kind: "airing"; next: string | null; last: string | null; episode?: { season: number; episode: number } }
  | { kind: "length"; seasons: number; episodes: number; episodeRuntime: number | null };

/**
 * What of a title is still to come, as its page says it. release / premiere: a film or a series not out yet — `date`
 * null while none is announced (TMDB lists it as planned or in production). season: an out series' next season, from
 * its first episode's date. episode: the next episode of a series on air. Numbers are the releases' (`nextEpisode`).
 */
export type TitleUpcoming =
  | { kind: "release"; date: string | null }
  | { kind: "premiere"; date: string | null }
  | { kind: "season"; season: number; date: string }
  | { kind: "episode"; season: number; episode: number; date: string };

export interface PersonSummary {
  id: number;
  name: string;
  profilePath: string | null;
  knownFor: string | null;
}

export interface CastMember extends PersonSummary {
  character: string | null;
  order: number;
}

export interface CrewMember extends PersonSummary {
  job: string;
  department: string;
}

export interface Video {
  key: string;
  site: "YouTube" | "Vimeo";
  name: string;
  type: string;
  official: boolean;
  language: string | null;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
  overview: string | null;
}

export interface EpisodeSummary {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string | null;
  airDate: string | null;
  runtime: number | null;
  stillPath: string | null;
  tmdbRating: number | null;
}

export interface WatchProvider {
  id: number;
  name: string;
  logoPath: string | null;
  kind: "flatrate" | "free" | "ads" | "rent" | "buy";
}

export interface ExternalIds {
  imdb: string | null;
  tvdb: number | null;
  wikidata: string | null;
}

export interface TitleDetails extends TitleSummary {
  tagline: string | null;
  runtime: number | null;
  status: string | null;
  genres: Genre[];
  countries: string[];
  spokenLanguages: string[];
  certification: string | null;
  homepage: string | null;
  /** The title's name in each finished language as TMDB gives it there (translation, else original): the languages' addresses. */
  localTitles?: Partial<Record<"en" | "uk" | "ru" | "es" | "de" | "fr" | "pt-BR" | "it" | "pl" | "tr", string>>;
  externalIds: ExternalIds;
  cast: CastMember[];
  crew: CrewMember[];
  creators: PersonSummary[];
  videos: Video[];
  /** Recommendations first, then similar titles; only candidates of the same form with shared genres (`pickRelated`). */
  related: TitleSummary[];
  /** Recommendations of another form (live action for an anime, anime for a film…) with shared genres. */
  relatedOther: TitleSummary[];
  collection: { id: number; name: string; parts: TitleSummary[] } | null;
  seasons: SeasonSummary[];
  nextEpisode: EpisodeSummary | null;
  lastEpisode: EpisodeSummary | null;
  /** What is still to come: a release date, a premiere, the next season or episode (`TitleUpcoming`). */
  upcoming?: TitleUpcoming | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  /**
   * A series whose seasons and episodes are numbered as releases count them, in one of TMDB's episode groups rather than
   * TMDB's own seasons (modules/numbering): the group's name and how many seasons each way. Absent or null otherwise.
   */
  numbering?: { group: string; seasons: number; tmdbSeasons: number | null } | null;
  networks: { id: number; name: string; logoPath: string | null }[];
  keywords: string[];
  /** Legal streaming offers for the requested region (TMDB × JustWatch data). */
  watchProviders: { region: string; link: string | null; providers: WatchProvider[] } | null;
  /** Title treatment artwork (transparent logo), in the UI language when available. */
  logo: TitleLogoArt | null;
  /** A textless Fanart.tv background, only when TMDB has no backdrop for the title. */
  altBackdrop: ArtImage | null;
}

/**
 * A logo or background from TMDB (a file path the client sizes) or Fanart.tv (full URLs). The
 * rights holder is Fanart.tv's record of it, when it has one.
 */
export interface ArtImage {
  source: "tmdb" | "fanart";
  path: string | null;
  url: string | null;
  /** Fanart.tv's ≤400 px copy. */
  previewUrl: string | null;
  aspectRatio: number;
  /** null for language-neutral art. */
  lang: string | null;
  copyright: string | null;
}

/** The chosen logo, and the next choice from the other provider if the first doesn't load. */
export type TitleLogoArt = ArtImage & { fallback: ArtImage | null };

/**
 * Third-party score sources. Each score is always shown on its own with its source and date; the
 * Lumovio Score (`TitleScore`) is a separate derived metric and replaces none of them.
 * Rotten Tomatoes' Tomatometer (critics) and Popcornmeter (`rotten_tomatoes_audience`) are separate.
 */
export type RatingSource =
  | "imdb"
  | "rotten_tomatoes"
  | "rotten_tomatoes_audience"
  | "metacritic"
  | "letterboxd"
  | "trakt"
  | "myanimelist"
  | "anilist"
  | "tvmaze";

export interface ExternalRating {
  source: RatingSource;
  /** Normalised 0–100, for badges and ordering. */
  score: number;
  /** As the source publishes it: "8.7/10", "73%", "74/100", "4.5/5". */
  display: string;
  /** Votes or reviews behind the score, when known. */
  count: number | null;
  /** Date of the published snapshot. */
  asOf: string | null;
  /** Who delivered the value: IMDb's score may come from IMDb's dataset, MDBList, OMDb or a Wikidata snapshot. */
  via: RatingProvider;
  /** When Lumovio fetched it, if the source states no snapshot date of its own. */
  fetchedAt: string | null;
  url: string | null;
}

export type RatingProvider = "imdb" | "mdblist" | "omdb" | "wikidata" | "tvmaze" | "anilist";

export type ExternalLinkSource =
  | "imdb"
  | "rotten_tomatoes"
  | "metacritic"
  | "letterboxd"
  | "kinopoisk"
  | "myanimelist"
  | "anilist"
  | "tvmaze"
  | "wikidata";

/** Scores and cross-links from sources other than TMDB (Wikidata, IMDb, MDBList, OMDb, TVmaze, AniList). */
export interface TitleExternal {
  titleId: TitleId;
  ratings: ExternalRating[];
  links: { source: ExternalLinkSource; url: string }[];
  /** Data providers to credit next to the scores. */
  credits: RatingProvider[];
  updatedAt: string | null;
  /** Lumovio Score with its breakdown; absent while the feature is off, null when no source counts. */
  score?: TitleScore | null;
}

/**
 * Lumovio Score: Lumovio's own derived 0–100 metric. It is
 * a percentile — 87 means "higher than 87% of films" (or series) — never any service's own score;
 * the source scores stay on their own chips.
 */
export type ScoreConfidence = "low" | "medium" | "high";
/** Methodology version: changing weights, `m`, thresholds or formulas makes a new one (the Credits page names it). */
export const LUMOVIO_SCORE_VERSION = 3;
export type ScoreSource = Exclude<RatingSource, "tvmaze"> | "tmdb";

export interface CardScore {
  score: number;
  confidence: "medium" | "high";
}

export interface ScoreInput {
  source: ScoreSource;
  via: RatingProvider | "tmdb";
  /** As the source publishes it ("7.8/10", "91%"). */
  display: string;
  count: number | null;
  /** The source's snapshot date, else when Lumovio fetched it; null for TMDB (read with the page). */
  asOf: string | null;
  group: "critics" | "audience";
  /** Where the source alone puts the title among titles of its kind, 0–100. */
  percentile: number;
  /** Its share of the overall score's weight, in percent. */
  share: number;
}

/** calibration: too few titles shared with IMDb to place the source; license: its terms keep it out; films_only: Letterboxd on a series; no_votes: zero votes. */
export type ScoreExclusion = "calibration" | "license" | "films_only" | "no_votes";

export interface TitleScore {
  score: number;
  critics: number | null;
  audience: number | null;
  confidence: ScoreConfidence;
  /** Sources that carry real weight (≥ 0.3): one alone — however many votes it has — keeps the score at low confidence. */
  sources: number;
  divergence: "critics_higher" | "audience_higher" | null;
  /** Released less than 30 days ago: early audience votes count for less. */
  early: boolean;
  /** Methodology version. */
  version: number;
  /** When the calibration in use was built (ISO); a new one changes every title's score at once. */
  calibration: string;
  inputs: ScoreInput[];
  excluded: { source: RatingSource | "tmdb"; reason: ScoreExclusion }[];
}

export interface SeasonDetails extends SeasonSummary {
  titleId: TitleId;
  episodes: EpisodeSummary[];
}

/** A person's page on another site (TMDB's external ids, their own site). */
export type PersonSite = "tmdb" | "imdb" | "wikidata" | "homepage" | "instagram" | "x" | "tiktok" | "youtube" | "facebook";

export interface PersonDetails extends PersonSummary {
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  knownForDepartment: string | null;
  /** As TMDB has it, for the words that change with it ("Actor" / "Actress"); null when not given. */
  gender?: "female" | "male" | null;
  /** The person on other sites, in the order the page lists them. */
  links?: { site: PersonSite; url: string }[];
  credits: (TitleSummary & {
    role: string | null;
    /** How the person took part (any of): a character, themselves (talk shows, documentaries), a crew job. */
    as?: ("acting" | "self" | "crew")[];
    /** TMDB's English crew jobs ("Director", "Producer"), which the client translates. */
    jobs?: string[];
    /** TMDB's English department of each of those jobs ({ Director: "Directing", Producer: "Production" }). */
    departments?: Record<string, string>;
    /** The characters played, as TMDB gives them. */
    characters?: string[];
    /** A series: how many of its episodes the person is in (TMDB's count, the largest of their roles in it). */
    episodes?: number | null;
    /** A film's cast: the place in its billing, 0 first (TMDB's `order`), to tell a lead from a bit part. */
    billing?: number | null;
  })[];
}

/** "More by …" on a title page's More like this: the film's director or the series' creator and their other titles. */
export interface MoreBy {
  person: { id: number; name: string; role: "director" | "creator" };
  items: TitleSummary[];
}

export interface Paged<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  /** True when `totalResults` is the source's count before Lumovio re-checked the conditions (the real number can be lower). */
  totalIsEstimate?: boolean;
  /** A sort by a score: how many of the filtered titles have it (`rated`, the ones listed) of all filtered (`of`). */
  coverage?: { rated: number; of: number };
  results: T[];
}

/** The catalog grid's sorts on Lumovio's own index (DiscoverQuery `sort`). */
export type IndexSort = "imdb" | "imdb_votes" | "lumovio" | "rt" | "metacritic";

/**
 * `GET /api/catalog/sorts?<the grid's filters>`: each index sort offered for these filters with how many of the
 * filtered titles it scores, or null when it isn't (no index, a filter it lacks, the Lumovio Score off, too few scored).
 */
export type CatalogSorts = Record<IndexSort, { rated: number; of: number } | null>;

/** `GET /api/catalog/search?q=&page=&kind=`. */
export const SearchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().min(1).max(50).default(1),
  /** Only films or only series, searched by TMDB itself (its count is the real one); without it, films, series and people. */
  kind: MediaKind.optional(),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export interface CatalogSearch {
  titles: Paged<TitleSummary>;
  /** People, only in a search without `kind` (and never for a profile with an age limit). */
  people: PersonSummary[];
  /** Page 1 of an adult's search without `kind`: how many films and how many series TMDB finds (the type chips). */
  counts?: { movie: number; tv: number };
  /** A profile with an age limit: results of the pages read were left out for it. */
  hidden?: boolean;
  /** The query as read on the other keyboard layout, when that is what was found ("bynthcntkkfh" → "интерстеллар"). */
  interpreted?: string;
  /** With people: the query reads as a person's name, so they go above the titles; false — below them. */
  peopleFirst?: boolean;
  /**
   * Search on the catalog index: a title is named like the query (exact, typing, a typo per word), not only resembling
   * it or TMDB's own answer for the text. The page offers the query on the other keyboard layout only then.
   */
  clear?: boolean;
}

/**
 * Mood shelves of the Movies landing and their grid (`mood=`): TMDB's tone keywords (any of
 * them), held to genres that fit the mood (any of them) and away from ones that don't, with TMDB's score and votes.
 * Keywords alone are too loose (Shawshank is "amused" on TMDB) and genres alone say nothing about tone.
 * A filter the grid sets itself replaces the mood's own of the same kind.
 */
export const MOODS = {
  /** hopeful, joyful, feelgood, lighthearted, comforting; comedy, family or romance; no horror, thriller, war, crime, documentary. */
  feel_good: { keywords: "325824|325832|275276|288816|325784", genres: "35|10751|10749", withoutGenres: "27,53,10752,80,99", ratingMin: 6.8, votesMin: 500 },
  /** nonlinear timeline, time loop, twist ending, surprise ending, mind-blowing, dream, philosophical; sci-fi, mystery or thriller; no animation or family. */
  mind_bending: { keywords: "157171|10854|326438|331114|323808|346773|212737", genres: "878|9648|53", withoutGenres: "16,10751", ratingMin: 7, votesMin: 1000 },
  /** suspenseful, intense; thriller, crime or mystery; no animation, family or horror. */
  edge_of_seat: { keywords: "314730|321464", genres: "53|80|9648", withoutGenres: "16,10751,27", ratingMin: 7, votesMin: 1000 },
} as const;
export type Mood = keyof typeof MOODS;
export const MOOD_KEYS = Object.keys(MOODS) as [Mood, ...Mood[]];

export const DiscoverQuery = z.object({
  kind: MediaKind.default("movie"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  /**
   * "votes" — most TMDB votes. On Lumovio's own catalog index (`IndexSort`; `GET /api/catalog/sorts` says which are
   * offered for the filters): "imdb" IMDb rating, "imdb_votes" most IMDb votes, "lumovio" Lumovio Score, "rt" Rotten
   * Tomatoes, "metacritic" Metacritic. Without the index, or with a filter it lacks (keywords, episodesMax, providers,
   * country), those are TMDB's "rating" ("imdb_votes": TMDB's "votes").
   */
  sort: z
    .enum(["popularity", "rating", "release_desc", "release_asc", "title", "votes", "imdb", "imdb_votes", "lumovio", "rt", "metacritic"])
    .default("popularity"),
  genres: z.string().optional(), // comma separated TMDB genre ids (AND)
  withoutGenres: z.string().optional(),
  yearFrom: z.coerce.number().int().min(1870).max(2100).optional(),
  yearTo: z.coerce.number().int().min(1870).max(2100).optional(),
  ratingMin: z.coerce.number().min(0).max(10).optional(),
  votesMin: z.coerce.number().int().min(0).optional(),
  /** Upper bound on the TMDB vote count: "lesser-known" picks. */
  votesMax: z.coerce.number().int().min(1).optional(),
  /** Catalog index only: at most this many IMDb votes ("Underrated"). */
  imdbVotesMax: z.coerce.number().int().min(1).optional(),
  /**
   * Catalog index only, while the Lumovio Score is on: "critics_higher" — the Score's Critics part 80+ and its Audience
   * part at least 20 points lower ("Critics loved it, audiences didn't").
   */
  opinions: z.enum(["critics_higher"]).optional(),
  /** Films: one of MOODS — its keywords, genres and thresholds, under the query's own (TMDB only). */
  mood: z.enum(MOOD_KEYS).optional(),
  language: z.string().length(2).optional(), // original language
  country: z.string().length(2).optional(), // origin country
  anime: z.coerce.boolean().optional(),
  keywords: z.string().optional(),
  /** Comma separated TMDB keyword ids to leave out (e.g. 264598 "tv special"). */
  withoutKeywords: z.string().regex(/^\d+(,\d+)*$/).optional(),
  runtimeMax: z.coerce.number().int().min(1).optional(),
  /** Set to 1 to drop titles whose runtime is unknown (implied by runtimeMax). */
  runtimeMin: z.coerce.number().int().min(1).optional(),
  /** Series only. "scripted": scripted shows and miniseries — no news, talk or reality; "mini": miniseries. */
  tvType: z.enum(["scripted", "mini"]).optional(),
  /** Series only: "ended" means the story is finished (TMDB status Ended; Canceled is not included). */
  tvStatus: z.enum(["ended", "returning"]).optional(),
  /** Series only: at most this many episodes in all, every one already aired (no next episode announced). */
  episodesMax: z.coerce.number().int().min(1).optional(),
  providers: z.string().optional(),
});
export type DiscoverQuery = z.infer<typeof DiscoverQuery>;

/** Billboard item on the home page: a title with its logo art for the cinematic hero. */
export interface FeaturedTitle extends TitleSummary {
  logo: TitleLogoArt | null;
}

/**
 * Home page or section landing. `mode` "now" ("watch now") keeps only titles with a copy on the
 * profile's servers; `servers` is how many servers the profile can play from (0 for guests).
 */
export interface CatalogPage {
  mode: "all" | "now";
  servers: number;
  featured: FeaturedTitle[];
  rows: CatalogRow[];
  /**
   * The comparison arm this page was built in ("lift_a", "lift_b"), for profiles with a
   * server; the page's discovery counters carry it in their page key.
   */
  variant?: string;
}

export interface CatalogRow {
  key: string;
  titleKey: string; // i18n key for the row heading
  /** Ready-made heading (e.g. a localized genre name) that takes precedence over `titleKey`. */
  title?: string;
  items: TitleSummary[];
  /** Link to the full listing for "see all". */
  href: string | null;
}

/** One calendar entry: an episode of a tracked series, or a watchlist film's release. */
export interface CalendarEvent {
  /** As published: the channel's local date, or the release date (YYYY-MM-DD). */
  date: string;
  /** Exact start in UTC when the schedule states an air time; null for date-only releases (most streaming). */
  airstamp: string | null;
  title: TitleSummary;
  kind: "episode" | "movie";
  season: number | null;
  episode: number | null;
  episodeName: string | null;
  badge: "premiere" | "season_premiere" | "finale" | null;
  /** A special TVmaze lists outside the season's numbering. */
  special: boolean;
  /** Network or streaming service. */
  channel: string | null;
  /** Who gave the date and time: TMDB, or TVmaze's schedule. */
  source: "tmdb" | "tvmaze";
}

/** A title's soundtrack albums, each confirmed by an id link (never by a same-named search hit). */
export interface Soundtrack {
  /** pending: the lookup runs in the background; none: no confirmed soundtrack. */
  status: "found" | "none" | "pending";
  albums: SoundtrackAlbum[];
}

export interface SoundtrackAlbum {
  /** MusicBrainz release group id. */
  mbid: string;
  title: string;
  /** score: composed music; songs: a compilation of songs from the title. */
  kind: "score" | "songs";
  /** Composers / performers for a score; empty for various-artists song albums. */
  artists: string[];
  year: number | null;
  /** Which id link says it is this title's: the title's Wikidata item, or MusicBrainz's link to its IMDb page. */
  confirmedBy: ("wikidata" | "musicbrainz")[];
  /** Only when Wikidata or MusicBrainz gives the Spotify album and Spotify confirms it. */
  spotify: { albumId: string; title: string | null } | null;
  musicbrainzUrl: string;
  /** Cover Art Archive; may not exist. */
  coverUrl: string;
}

