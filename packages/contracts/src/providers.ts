import { z } from "zod";
import { TitleId } from "./media";

/**
 * Personal media servers are reached DIRECTLY from the user's device (browser/TV/PWA).
 * The Lumovio backend stores the connection (secrets encrypted at rest) and the availability
 * index the client uploads, but never fetches user-supplied URLs itself — no SSRF surface and
 * no video traffic through the Lumovio VPS.
 */
export const ProviderKind = z.enum(["jellyfin", "plex", "torrserver"]);
export type ProviderKind = z.infer<typeof ProviderKind>;

export const JellyfinAuth = z.object({
  kind: z.literal("jellyfin"),
  userId: z.string().min(1).max(64),
  accessToken: z.string().min(1).max(256),
  serverId: z.string().max(64).optional(),
  serverName: z.string().max(120).optional(),
});

export const PlexAuth = z.object({
  kind: z.literal("plex"),
  /** plex.tv account token from the PIN flow. */
  authToken: z.string().min(1).max(256),
  /** Selected server resource. */
  machineIdentifier: z.string().max(80).optional(),
  serverAccessToken: z.string().max(256).optional(),
  connections: z
    .array(z.object({ uri: z.string().url(), local: z.boolean(), relay: z.boolean() }))
    .max(20)
    .optional(),
});

export const TorrServerAuth = z.object({
  kind: z.literal("torrserver"),
  username: z.string().max(120).nullable(),
  password: z.string().max(256).nullable(),
});

export const ProviderAuth = z.discriminatedUnion("kind", [JellyfinAuth, PlexAuth, TorrServerAuth]);
export type ProviderAuth = z.infer<typeof ProviderAuth>;

export const ConnectionSettings = z.object({
  /** Push Lumovio player progress back to Jellyfin/Plex. */
  syncProgressToServer: z.boolean().default(false),
  /** Import watched state from the server on manual sync. */
  importWatchedFromServer: z.boolean().default(false),
  maxBitrateKbps: z.number().int().min(500).max(200_000).nullable().default(null),
  preferDirectPlay: z.boolean().default(true),
  /** TorrServer: the device searches its indexers on its own (title pages, the watchlist) for the profile's audio languages. */
  autoSearch: z.boolean().default(true),
});
export type ConnectionSettings = z.infer<typeof ConnectionSettings>;

export const ConnectionCreate = z.object({
  kind: ProviderKind,
  name: z.string().trim().min(1).max(60),
  baseUrl: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//.test(u), "http(s) only"),
  auth: ProviderAuth,
  settings: ConnectionSettings.partial().optional(),
  /** Profiles allowed to use this connection; empty = all non-kids profiles. */
  profileIds: z.array(z.string().uuid()).max(20).optional(),
});
export type ConnectionCreate = z.infer<typeof ConnectionCreate>;

export const ConnectionUpdate = ConnectionCreate.partial().omit({ kind: true });

export type ConnectionStatus = "unknown" | "ok" | "degraded" | "unreachable" | "unauthorized";

/** Public view of a connection: never includes secrets. */
export interface ConnectionSummary {
  id: string;
  kind: ProviderKind;
  name: string;
  baseUrl: string;
  status: ConnectionStatus;
  statusDetail: string | null;
  lastCheckedAt: string | null;
  lastSyncedAt: string | null;
  itemCount: number;
  settings: ConnectionSettings;
  profileIds: string[];
  createdAt: string;
}

/** Secrets for the owner's own client, returned only on an explicit, rate-limited request. */
export interface ConnectionCredentials {
  id: string;
  baseUrl: string;
  auth: ProviderAuth;
}

/** Status report from a client-side connectivity test. */
export const ConnectionCheckReport = z.object({
  status: z.enum(["ok", "degraded", "unreachable", "unauthorized"]),
  detail: z.string().max(300).nullable(),
  serverVersion: z.string().max(60).nullable().optional(),
  latencyMs: z.number().int().min(0).max(120_000).nullable().optional(),
});

/** One availability record uploaded by the client after scanning a library. */
export const LibraryIndexEntry = z.object({
  titleId: TitleId,
  externalId: z.string().min(1).max(128),
  season: z.number().int().min(0).nullable().default(null),
  episode: z.number().int().min(0).nullable().default(null),
  label: z.string().max(200).nullable().default(null),
  quality: z
    .object({
      resolution: z.string().max(16).nullable(),
      videoCodec: z.string().max(24).nullable(),
      audioCodecs: z.array(z.string().max(24)).max(16),
      /**
       * The audio tracks' languages (ISO 639-1, each once, as the server tags them): Jellyfin's and Plex's scans; a
       * series' from a few of its first episodes. TorrServer copies have none — their release name tells.
       */
      audioLanguages: z.array(z.string().min(2).max(3)).max(16),
      /**
       * How many subtitle tracks the server's scan saw (embedded and external; a series': a few of its first episodes'),
       * for the CC mark. Absent from copies scanned before 2026-11-06, and for TorrServer copies — their release name tells.
       */
      subtitleTracks: z.number().int().min(0).max(999),
      /**
       * A TorrServer copy's audio tracks as its file lists them, "<language tag>|<title>" in the file's order
       * ("rus|MVO, LostFilm"), read when it was last played (`/index/tracks`): the studios its release name may not
       * name ("6x MVO"). Absent until it is played; kept through rescans.
       */
      audioTracks: z.array(z.string().max(160)).max(32),
      hdr: z.string().max(24).nullable(),
      container: z.string().max(24).nullable(),
      sizeBytes: z.number().int().min(0).nullable(),
    })
    .partial()
    .nullable()
    .default(null),
});
export type LibraryIndexEntry = z.infer<typeof LibraryIndexEntry>;

export const LibraryIndexUpload = z.object({
  /** "replace" swaps the whole index after a full scan; "merge" adds/updates entries. */
  mode: z.enum(["replace", "merge"]),
  entries: z.array(LibraryIndexEntry).max(5000),
  /** Present when uploading a replace scan in several chunks. */
  scanId: z.string().max(64).optional(),
  final: z.boolean().default(true),
});

/** Torrent files bound to a film (season/episode null) or to episodes: externalId "<hash>:<fileIndex>". */
export const TorrentBind = z.object({
  titleId: TitleId,
  entries: z
    .array(
      z.object({
        season: z.number().int().min(0).nullable(),
        episode: z.number().int().min(0).nullable(),
        externalId: z.string().regex(/^[a-f0-9]{40}:\d+$/i),
        label: z.string().max(200).nullable(),
      }),
    )
    .min(1)
    .max(500),
  /** The person chose these files: replace what this server had for the same film/episodes. */
  replace: z.boolean().default(false),
  /**
   * With `replace`: the person chose the torrent, but its files were matched to the episodes, not
   * chosen. A file unlinked from its episode is then refused rather than linked again.
   */
  matched: z.boolean().default(false),
});

/**
 * `POST /api/catalog/match`: catalog titles for torrents already on a TorrServer, which the device matches itself — by
 * the title words of a release's name (never the name itself, a hash or a link) or a title id the torrent's own data
 * names. Answers `{ results: Record<key, TitleSummary[]> }`; nothing is linked by it.
 */
export const CatalogMatch = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(256),
        query: z.string().trim().min(2).max(200).optional(),
        titleId: TitleId.optional(),
        kind: z.enum(["movie", "tv"]).optional(),
      }),
    )
    .min(1)
    .max(40),
});

/** "I chose this source": it comes first in availability from now on. */
export const SourceTouch = z.object({ titleId: TitleId, externalId: z.string().min(1).max(128) });

/** The audio tracks the player read in a TorrServer torrent's file ("<language tag>|<title>"), kept with its index entries. */
export const TorrentTracks = z.object({
  hash: z.string().regex(/^[a-f0-9]{40}$/i),
  tracks: z.array(z.string().max(160)).max(32),
});

/**
 * A release's audio as its file says it, shared by every account (design-system 7.15 «Чтение дорожек заранее»): what
 * the pick needs and nothing else — each track "<ISO 639-1>|<kind>, <studio or credit>" ("ru|mvo, LostFilm"), the
 * languages of forced subtitles. No file names, no paths, nothing of the account. Keyed by the tracker and the release's
 * name (a Jackett result has no hash), and by the hash when it is known.
 */
const ReleaseTrack = z.string().regex(/^[a-z]{0,3}\|[\p{L}\p{N} .,'&+()!-]{0,60}$/u);
export const ReleaseKey = z.object({
  tracker: z.string().max(60).nullable(),
  title: z.string().min(1).max(250),
  hash: z.string().regex(/^[a-f0-9]{40}$/i).nullable(),
});
export type ReleaseKey = z.infer<typeof ReleaseKey>;
export const ReleaseTracksLookup = z.object({ keys: z.array(ReleaseKey).max(100) });
export const ReleaseTracksRead = ReleaseKey.extend({
  tracks: z.array(ReleaseTrack).min(1).max(32),
  forced: z.array(z.string().regex(/^[a-z]{2,3}$/)).max(8).default([]),
  /** Who read it: the player preparing the file, or a read ahead (a probe of the header). */
  via: z.enum(["player", "probe"]),
});
export type ReleaseTracksRead = z.infer<typeof ReleaseTracksRead>;
export interface ReleaseTracksFound {
  found: { tracker: string | null; title: string; hash: string | null; tracks: string[]; forced: string[] }[];
}

/**
 * Torrents that are no longer on a TorrServer (removed from it, or missing from a full list it gave):
 * their index entries go — the torrent and every file of it bound to a film or episode.
 */
export const TorrentForget = z.object({
  hashes: z
    .array(z.string().regex(/^[a-f0-9]{40}$/i))
    .min(1)
    .max(200),
});

/**
 * One torrent taken off one title in Lumovio's index — or, with `episode`, only its file bound to that
 * one episode (the torrent stays linked to the series and its other episodes). The torrent itself
 * stays on the server either way.
 */
export const TorrentUnlink = z.object({
  titleId: TitleId,
  hash: z.string().regex(/^[a-f0-9]{40}$/i),
  episode: z.object({ season: z.number().int().min(0), episode: z.number().int().min(0) }).optional(),
});

/** What a bind stored, and which of its files were refused: unlinked from that title or episode by the person (not an explicit choice). */
export interface TorrentBindResult {
  stored: number;
  refused: string[];
}

/** A TorrServer connection's index by torrent: what each torrent is linked to in Lumovio. */
export interface TorrentIndexEntry {
  /** Lower-case info hash. */
  hash: string;
  links: { titleId: TitleId; season: number | null; episode: number | null; externalId: string; label: string | null; quality: LibraryIndexEntry["quality"] }[];
}

export interface ConnectionTorrentIndex {
  torrents: TorrentIndexEntry[];
  /** The linked titles, by id; a title TMDB no longer has is left out. */
  titles: Record<string, { title: string; year: number | null; posterPath: string | null }>;
}

export interface Availability {
  connectionId: string;
  kind: ProviderKind;
  connectionName: string;
  externalId: string;
  label: string | null;
  season: number | null;
  episode: number | null;
  quality: LibraryIndexEntry["quality"];
}

/** A profile's connection as far as availability is concerned (no URL, no secrets). */
export interface SourceState {
  id: string;
  kind: ProviderKind;
  name: string;
  status: ConnectionStatus;
  /** False until the first library scan has been uploaded (always true for TorrServer, which has no scan). */
  indexed: boolean;
  /** TorrServer whose indexers this device may search on its own (`ConnectionSettings.autoSearch`). */
  autoSearch: boolean;
}

/** `/api/availability/:titleId`: everything needed to say where a title can be watched. */
export interface TitleAvailability {
  servers: Availability[];
  /** Connections visible to the profile; 0 for guests. */
  connections: number;
  sources: SourceState[];
}

export type PlaybackMethod = "direct" | "remux" | "transcode" | "external";

/** How the client decided to play something — persisted only as anonymous diagnostics. */
export const PlaybackDiagnostic = z.object({
  provider: z.enum(["jellyfin", "plex", "torrserver"]),
  method: z.enum(["direct", "remux", "transcode", "external"]),
  outcome: z.enum(["started", "failed", "fallback"]),
  errorCode: z.string().max(60).nullable(),
  container: z.string().max(24).nullable(),
  videoCodec: z.string().max(24).nullable(),
  audioCodec: z.string().max(24).nullable(),
  platform: z.string().max(60),
  /** A start's time from the source handed to the player to its first play, ms. */
  ttffMs: z.number().int().min(0).max(600_000).optional(),
});

/** The best release a TorrServer search found for a title, as kept for the profile: no link, hash or tracker. */
export const TorrentFindBest = z.object({
  /** One of the profile's audio languages (ISO 639-1), or null. */
  language: z.string().min(2).max(3).nullable(),
  voice: z.enum(["dub", "mvo", "dvo", "avo", "vo"]).nullable(),
  studio: z.string().min(1).max(40).nullable(),
  resolution: z.union([z.literal(2160), z.literal(1080), z.literal(720), z.literal(480)]).nullable(),
  /**
   * Every picture version the best release's audio option (its studio, else its language) was found in, lowest first
   * — 1080p · 4K SDR · 4K HDR; `range` null when the names don't say. Absent from finds reported before it was kept.
   */
  pictures: z
    .array(
      z.object({
        resolution: z.union([z.literal(2160), z.literal(1080), z.literal(720), z.literal(480)]).nullable(),
        range: z.enum(["hdr", "dv", "sdr"]).nullable(),
      }),
    )
    .max(8)
    .optional(),
});
export type TorrentFindBest = z.infer<typeof TorrentFindBest>;

/** A device reports one search: the best release, or null when nothing live was found. */
export const TorrentFindReport = z.object({ titleId: TitleId, best: TorrentFindBest.nullable() });

/**
 * What a series' releases say about its seasons, as a device saw them (season numbering, api modules/numbering):
 * `names` — this title's release names in a TorrServer search; `files` — one torrent's files the player read. Per
 * season: `max` — the highest episode one release holds, `total` — a length a name states ("1-9 из 9"); `releases` —
 * how many releases say it. Never a name, link, hash or tracker.
 */
export const NumberingEvidenceReport = z.object({
  titleId: TitleId,
  source: z.enum(["names", "files"]),
  seasons: z
    .array(
      z.object({
        season: z.number().int().min(1).max(99),
        kind: z.enum(["max", "total"]),
        episodes: z.number().int().min(1).max(999),
        releases: z.number().int().min(1).max(500),
      }),
    )
    .min(1)
    .max(100),
});
export type NumberingEvidenceReport = z.infer<typeof NumberingEvidenceReport>;

export interface TorrentFind {
  checkedAt: string;
  best: TorrentFindBest | null;
  /** First day a release in one of the profile's languages was found (YYYY-MM-DD); null while there is none. */
  firstSeen: string | null;
}
