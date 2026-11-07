import type { LibraryIndexEntry, PlaybackMethod, ProviderKind, ServerHistory } from "@lumovio/contracts";
import type { AudioRoute } from "./playback-choice";
import type { VoiceWish } from "./releases";

/** A concrete thing we could play for a title (one file on one server, or one open source). */
export interface PlayableCandidate {
  key: string; // stable id used in URLs: "open:<id>" | "<connectionId>:<externalId>"
  provider: ProviderKind | "open";
  connectionId: string | null;
  externalId: string;
  label: string;
  detail: string | null;
}

export interface SubtitleTrack {
  id: string;
  lang: string;
  label: string;
  url: string;
  kind: "subtitles" | "captions";
}

export interface AudioOption {
  index: number;
  label: string;
  lang: string | null;
  codec: string | null;
  isDefault: boolean;
}

/** A marked part of the timeline (from Jellyfin media segments or Plex markers). */
export interface MediaSegment {
  kind: "intro" | "recap" | "outro" | "preview" | "commercial";
  start: number;
  end: number;
}

/** Timeline thumbnails packed into sprite sheets (Jellyfin trickplay). */
export interface TrickplayInfo {
  tileUrl: (sheet: number) => string;
  /** Size of one thumbnail in px. */
  width: number;
  height: number;
  /** Thumbnails per sheet row / column. */
  cols: number;
  rows: number;
  count: number;
  intervalMs: number;
}

/** What the "playback info" panel shows; whatever the source knows. */
export interface StreamInfo {
  container: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
  bitrate: number | null;
}

/** Everything the player needs to start, plus provider hooks for progress sync. */
export interface PreparedPlayback {
  url: string;
  /** "remux": `url` is a file the browser rebuilds itself (`lib/media/remux.ts`) before playing. */
  type: "progressive" | "hls" | "remux";
  /** For "remux": the audio stream it plays (an `AudioOption.index`). */
  remuxAudio?: number;
  /** For "remux": how that audio comes out — copied as it is, or converted to AAC / Opus in the browser. */
  remuxRoute?: AudioRoute;
  /** For "remux": "legacy" — an old AVI decoded in WASM, its video encoded to H.264 here (`legacy.ts`), not Mediabunny's rebuild. */
  remuxEngine?: "legacy";
  /**
   * For "remux": the server's own address and sign-in, which the engine sends itself — not through the service worker
   * that `url` needs for a password (a phone may have none; in Firefox its long streams failed). Never shown or logged.
   */
  remuxSource?: { url: string; headers: Record<string, string>; targetAddressSpace?: "loopback" | "local" };
  /**
   * Subtitles the browser can't read itself (PLR-14; `lib/media/subs/engine.ts`): `file` — the video file read by ranges
   * for its own tracks (a Matroska file whose probe lists text or PGS subtitles), with the server's sign-in like
   * `remuxSource`; `files` — subtitle files next to it in the torrent. Never shown or logged.
   */
  subtitleSources?: {
    file: { url: string; headers: Record<string, string>; targetAddressSpace?: "loopback" | "local" } | null;
    files: { path: string; format: "srt" | "vtt" | "ass"; lang: string | null; forced: boolean; label: string | null; url: string }[];
    /** The sign-in for `files`. */
    headers: Record<string, string>;
    targetAddressSpace?: "loopback" | "local";
  };
  mime: string | null;
  /**
   * For "hls": its playlist starts at the film's beginning (Jellyfin's always does), so the player seeks to the start
   * position itself, as for a file. Plex's starts at the `offset` asked for and needs no seek.
   */
  seekToStart?: boolean;
  method: PlaybackMethod;
  methodNote: string | null;
  subtitles: SubtitleTrack[];
  audio: AudioOption[];
  /** Server-side audio switching (Jellyfin/Plex transcodes) — returns a new playback. */
  selectAudio?: (index: number) => Promise<PreparedPlayback>;
  durationSec: number | null;
  /** It plays, but not as it should here: "dv5" — Dolby Vision profile 5 on a browser that doesn't decode it (wrong colours; PLR-15). */
  warning?: "dv5";
  /** Link for VLC/mpv/Infuse (may embed server credentials — never shown in full). */
  externalUrl: string | null;
  incompatibility: string | null;
  reportStart?: (positionSec: number) => void;
  reportProgress?: (positionSec: number, paused: boolean) => void;
  reportStop?: (positionSec: number) => void;
  /** Intro / recap / credits ranges for skip buttons. */
  segments?: MediaSegment[];
  trickplay?: TrickplayInfo | null;
  info?: Partial<StreamInfo>;
  /**
   * How a dubbing chosen before the file was read (`VoiceWish`) came out: "playing" its track, or
   * "unknown" when no track could be told to be it and the file's default plays.
   */
  voice?: { studio: string; match: "playing" | "unknown" };
  /** TorrServer peers/speed; a field the server did not report is null, not 0. */
  stats?: () => Promise<{ peers: number | null; seeders: number | null; speedBps: number | null; preloadedBytes: number | null } | null>;
}

export interface ScanProgress {
  scanned: number;
  total: number | null;
}

export interface ProviderClient {
  kind: ProviderKind;
  test(): Promise<{ version: string | null; latencyMs: number; serverName: string | null }>;
  /** Full library scan for the availability index. */
  scan?(onProgress: (p: ScanProgress) => void): Promise<LibraryIndexEntry[]>;
  /** `voice`: the dubbing chosen with a TorrServer release, matched to the file's tracks when no `audioIndex` is given. */
  /** `rebuild`: the plain stream failed to start here: rebuild the file in the browser when it can be (TorrServer). */
  prepare(externalId: string, opts: { startSec?: number; audioIndex?: number; voice?: VoiceWish | null; rebuild?: boolean }): Promise<PreparedPlayback>;
  /** Locate an episode's file id on the server (episode-level playback). */
  findEpisode?(seriesExternalId: string, season: number, episode: number): Promise<string | null>;
  /** What the signed-in account has played on the server (films and episodes; an episode with its series' ids): Import history. */
  history?(onProgress: (p: ScanProgress) => void): Promise<ServerHistory["items"]>;
}
