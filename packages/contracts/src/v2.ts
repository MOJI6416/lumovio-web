import type { ArtImage, MediaKind, TitleLogoArt, TitleUpcoming, Video, WatchProvider } from "./media";

/*
 * The catalog API on Lumovio's own codes (`/api/v2/…`): every entity is named by its public code — 8 Crockford base32
 * symbols, the first one a letter (`ewzsjd5z`) — and the ids other services give it are data in `externalIds`. The
 * older `/api/catalog/…` routes keep their TMDB-id shape and add the code (`code`) beside it.
 */

/** A public code: 8 symbols of 0-9 a-z without i, l, o, u, the first one a letter (`ewzsjd5z`). */
export type Code = string;

/**
 * How complete an entity is: `stub` — a name, a year and its ids (from the services' daily lists); `basic` — the
 * details of a source or two; `full` — every source.
 */
export type CatalogLevel = "stub" | "basic" | "full";

/**
 * The entity's ids in other services, those it has: `tmdb` and `tvdb` numbers, `imdb` (tt…, nm…), `wikidata` (Q…) and
 * the rest as the service writes them.
 */
export type ExternalIdsV2 = Partial<{
  tmdb: number;
  imdb: string;
  wikidata: string;
  tvdb: number;
  tvmaze: number;
  kinopoisk: string;
  letterboxd: string;
  mal: number;
  anilist: number;
  trakt: number;
  rt: string;
  metacritic: string;
}>;

/** A score of a service, 0–10 (or the service's own scale), with its votes when it counts them. */
export interface ScoreV2 {
  value: number;
  votes: number | null;
}

/** A film or a series as cards, shelves and lists show it, in the page's language. */
export interface TitleCardV2 {
  id: Code;
  kind: MediaKind;
  title: string;
  originalTitle: string | null;
  year: number | null;
  releaseDate: string | null;
  /** A picture's reference: a TMDB path (`/abc.jpg`) or another source's (`fanart:/…`), sized by the client. */
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
  scores: Partial<Record<"tmdb" | "imdb", ScoreV2>>;
  /** Lumovio's own genres (keys; the names come with the title's page). */
  genres: string[];
  originalLanguage: string | null;
  isAnime: boolean;
  level: CatalogLevel;
  externalIds: ExternalIdsV2;
}

export interface PersonRefV2 {
  id: Code;
  name: string;
  profilePath: string | null;
  knownFor: string | null;
  externalIds: ExternalIdsV2;
}

export interface CastV2 extends PersonRefV2 {
  character: string | null;
  order: number;
  /** A series: in how many of its episodes. */
  episodes: number | null;
}

export interface CrewV2 extends PersonRefV2 {
  job: string;
  department: string | null;
}

export interface SeasonSummaryV2 {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
  overview: string | null;
}

export interface EpisodeV2 {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string | null;
  airDate: string | null;
  /** The moment it airs, where a schedule gives the time (ISO 8601), and the zone it airs in. */
  airAt: string | null;
  airZone: string | null;
  runtime: number | null;
  stillPath: string | null;
  externalIds: ExternalIdsV2;
}

export interface CompanyRefV2 {
  id: Code;
  name: string;
  logoPath: string | null;
  externalIds: ExternalIdsV2;
}

/** A title's page (`GET /api/v2/title/:code`), in the page's language. */
export interface TitleV2 extends TitleCardV2 {
  tagline: string | null;
  runtime: number | null;
  status: string | null;
  format: string | null;
  genreNames: { key: string; name: string }[];
  countries: string[];
  /** Age ratings by country, and the one for the asked region. */
  ages: Record<string, string>;
  certification: string | null;
  /** The title's name in each of the site's languages (its addresses there). */
  localTitles: Record<string, string>;
  cast: CastV2[];
  crew: CrewV2[];
  creators: PersonRefV2[];
  videos: Video[];
  collection: { id: Code; name: string; parts: TitleCardV2[] } | null;
  seasons: SeasonSummaryV2[];
  nextEpisode: EpisodeV2 | null;
  lastEpisode: EpisodeV2 | null;
  upcoming: TitleUpcoming | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  networks: CompanyRefV2[];
  keywords: string[];
  watchProviders: { region: string; link: string | null; providers: (Omit<WatchProvider, "id"> & { id: string })[] } | null;
  logo: TitleLogoArt | null;
  altBackdrop: ArtImage | null;
  /** More like this: the same form first, then others. */
  related: TitleCardV2[];
  relatedOther: TitleCardV2[];
  /** The catalog is loading the title's details now: the page shows what there is and asks again in a few seconds. */
  pending: boolean;
}

export interface SeasonV2 extends SeasonSummaryV2 {
  title: Code;
  episodes: EpisodeV2[];
  pending: boolean;
}

export interface PersonCreditV2 extends TitleCardV2 {
  role: string | null;
  as: ("acting" | "self" | "crew")[];
  jobs: string[];
  departments: Record<string, string>;
  characters: string[];
  episodes: number | null;
  billing: number | null;
}

/** A person's page (`GET /api/v2/person/:code`). */
export interface PersonV2 extends PersonRefV2 {
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  gender: "female" | "male" | "nonbinary" | null;
  links: { site: string; url: string }[];
  credits: PersonCreditV2[];
  pending: boolean;
}

/** A collection's page (`GET /api/v2/collection/:code`). */
export interface CollectionV2 {
  id: Code;
  name: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  parts: TitleCardV2[];
  externalIds: ExternalIdsV2;
}

/** A company's or a network's page (`GET /api/v2/company/:code`): its titles, best known first. */
export interface CompanyV2 extends CompanyRefV2 {
  country: string | null;
  titles: TitleCardV2[];
}

/** `GET /api/v2/search?q=&page=&kind=`. */
export interface SearchV2 {
  page: number;
  totalPages: number;
  totalResults: number;
  results: TitleCardV2[];
  people: PersonRefV2[];
  counts?: { movie: number; tv: number };
  hidden?: boolean;
}

/**
 * An entity asked by a code that was merged into another (or by an id of another service): the answer is the entity
 * under its own code, and `GET` by the old one answers 301 to it.
 */
export interface MovedV2 {
  id: Code;
}
