import type { LibraryIndexEntry, ServerHistory } from "@lumovio/contracts";
import { canDirectPlay, detectCapabilities, type PlaybackCapabilities } from "./capabilities";
import { background, optional } from "../optional";
import { audioLanguages } from "./languages";
import { deviceId, joinUrl, mediaFetch } from "./net";
import type { AudioOption, MediaSegment, PreparedPlayback, ProviderClient, ScanProgress, SubtitleTrack } from "./types";

const CLIENT = "Lumovio";
const VERSION = "0.1.0";
const TICKS = 10_000_000;

const SEGMENT_KIND: Record<string, MediaSegment["kind"]> = { Intro: "intro", Recap: "recap", Outro: "outro", Preview: "preview", Commercial: "commercial" };

/** Jellyfin 10.10+ media segments (filled by provider plugins such as Intro Skipper). */
export function parseSegments(items: { Type: string; StartTicks: number; EndTicks: number }[]): MediaSegment[] {
  return items
    .flatMap((x) => {
      const kind = SEGMENT_KIND[x.Type];
      const start = x.StartTicks / TICKS;
      const end = x.EndTicks / TICKS;
      return kind && end - start >= 3 ? [{ kind, start, end }] : [];
    })
    .sort((a, b) => a.start - b.start);
}

export interface JfTrickplay {
  Width: number;
  Height: number;
  TileWidth: number;
  TileHeight: number;
  ThumbnailCount: number;
  Interval: number;
}

/** Trickplay resolution closest to 320 px wide for this media source (any source as a fallback). */
export function pickTrickplay(map: Record<string, Record<string, JfTrickplay>> | undefined, sourceId: string): (JfTrickplay & { key: string }) | null {
  const bySource = map?.[sourceId] ?? Object.values(map ?? {})[0];
  if (!bySource) return null;
  const options = Object.entries(bySource).map(([key, v]) => ({ key, ...v }));
  options.sort((a, b) => Math.abs(a.Width - 320) - Math.abs(b.Width - 320));
  return options[0] ?? null;
}

function authHeader(token?: string): string {
  const parts = [`Client="${CLIENT}"`, `Device="${typeof navigator !== "undefined" ? navigator.platform || "Web" : "Web"}"`, `DeviceId="${deviceId()}"`, `Version="${VERSION}"`];
  if (token) parts.push(`Token="${token}"`);
  return `MediaBrowser ${parts.join(", ")}`;
}

async function jf<T>(base: string, path: string, token: string | undefined, init: RequestInit = {}): Promise<T> {
  const res = await mediaFetch(joinUrl(base, path), {
    ...init,
    headers: { Authorization: authHeader(token), "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
  });
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export interface JellyfinAuthResult {
  userId: string;
  accessToken: string;
  serverId: string;
  serverName?: string;
}

export async function jellyfinPublicInfo(base: string): Promise<{ ServerName: string; Version: string; Id: string }> {
  return jf(base, "/System/Info/Public", undefined);
}

/** Password goes straight from this device to the user's Jellyfin; Lumovio only stores the token. */
export async function jellyfinLogin(base: string, username: string, password: string): Promise<JellyfinAuthResult> {
  const r = await jf<{ AccessToken: string; User: { Id: string }; ServerId: string }>(base, "/Users/AuthenticateByName", undefined, {
    method: "POST",
    body: JSON.stringify({ Username: username, Pw: password }),
  });
  return { userId: r.User.Id, accessToken: r.AccessToken, serverId: r.ServerId };
}

/** Quick Connect: no password at all — the user approves a code inside their Jellyfin. */
export async function jellyfinQuickConnect(base: string): Promise<{ code: string; poll: () => Promise<JellyfinAuthResult | null> } | null> {
  const enabled = await jf<boolean>(base, "/QuickConnect/Enabled", undefined).catch(() => false);
  if (!enabled) return null;
  const init = await jf<{ Secret: string; Code: string }>(base, "/QuickConnect/Initiate", undefined, { method: "POST" });
  return {
    code: init.Code,
    poll: async () => {
      const s = await jf<{ Authenticated: boolean }>(base, `/QuickConnect/Connect?secret=${encodeURIComponent(init.Secret)}`, undefined);
      if (!s.Authenticated) return null;
      const r = await jf<{ AccessToken: string; User: { Id: string }; ServerId: string }>(base, "/Users/AuthenticateWithQuickConnect", undefined, {
        method: "POST",
        body: JSON.stringify({ Secret: init.Secret }),
      });
      return { userId: r.User.Id, accessToken: r.AccessToken, serverId: r.ServerId };
    },
  };
}

interface JfStream {
  Type: "Video" | "Audio" | "Subtitle";
  Index: number;
  Codec?: string;
  Language?: string;
  DisplayTitle?: string;
  Title?: string;
  IsDefault?: boolean;
  IsExternal?: boolean;
  IsTextSubtitleStream?: boolean;
  DeliveryMethod?: "Encode" | "Embed" | "External" | "Hls";
  DeliveryUrl?: string;
  Height?: number;
  Width?: number;
  BitDepth?: number;
  VideoRange?: string;
  /** "SDR", "HDR10", "HDR10Plus", "HLG", "DOVI", "DOVIWithHDR10"… (Jellyfin 10.8+). */
  VideoRangeType?: string;
  Profile?: string;
}

interface JfMediaSource {
  Id: string;
  Container: string;
  SupportsDirectPlay: boolean;
  SupportsDirectStream: boolean;
  SupportsTranscoding: boolean;
  TranscodingUrl?: string;
  TranscodeReasons?: string[];
  RunTimeTicks?: number;
  MediaStreams: JfStream[];
  Size?: number;
  Bitrate?: number;
}

interface JfItem {
  Id: string;
  Name: string;
  Type: "Movie" | "Series" | "Episode";
  ProviderIds?: Record<string, string>;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  SeriesId?: string;
  RunTimeTicks?: number;
  MediaSources?: JfMediaSource[];
  /** With `Fields=MediaStreams` (episodes, for a series' audio languages). */
  MediaStreams?: JfStream[];
  UserData?: { PlaybackPositionTicks?: number; Played?: boolean; LastPlayedDate?: string };
  ProductionYear?: number;
}

export function resolutionLabel(width: number, height: number): string {
  const h = Math.max(height, Math.round((width * 9) / 16));
  return h >= 2000 ? "2160p" : h >= 1000 ? "1080p" : h >= 700 ? "720p" : h >= 560 ? "576p" : `${height}p`;
}

/** Jellyfin DeviceProfile generated from what this browser really decodes. */
export function deviceProfile(caps: PlaybackCapabilities, maxBitrate: number) {
  const vCodecs = [caps.video.h264 && "h264", caps.video.hevc && "hevc", caps.video.av1 && "av1", caps.video.vp9 && "vp9"].filter(Boolean).join(",");
  const aCodecs = [caps.audio.aac && "aac", caps.audio.mp3 && "mp3", caps.audio.opus && "opus", caps.audio.flac && "flac", caps.audio.ac3 && "ac3", caps.audio.eac3 && "eac3", caps.audio.vorbis && "vorbis"]
    .filter(Boolean)
    .join(",");
  const containers = ["mp4", "m4v", caps.containers.webm && "webm", caps.containers.mkv === "likely" && "mkv", caps.containers.mov && "mov"].filter(Boolean) as string[];
  return {
    Name: "Lumovio Web",
    MaxStreamingBitrate: maxBitrate,
    MaxStaticBitrate: maxBitrate,
    MusicStreamingTranscodingBitrate: 384000,
    DirectPlayProfiles: containers.map((c) => ({ Container: c, Type: "Video", VideoCodec: vCodecs, AudioCodec: aCodecs })),
    TranscodingProfiles: [
      {
        Container: "ts",
        Type: "Video",
        VideoCodec: caps.video.hevc ? "h264,hevc" : "h264",
        AudioCodec: caps.audio.ac3 ? "aac,ac3" : "aac",
        Protocol: "hls",
        Context: "Streaming",
        MaxAudioChannels: "6",
        MinSegments: "1",
        BreakOnNonKeyFrames: true,
      },
    ],
    ContainerProfiles: [],
    CodecProfiles: [
      {
        Type: "Video",
        Codec: "h264",
        Conditions: [{ Condition: "LessThanEqual", Property: "VideoBitDepth", Value: caps.video.h264High10 ? "10" : "8", IsRequired: false }],
      },
      { Type: "Video", Conditions: [{ Condition: "LessThanEqual", Property: "Height", Value: String(caps.maxHeight), IsRequired: false }] },
    ],
    SubtitleProfiles: [
      { Format: "vtt", Method: "External" },
      { Format: "srt", Method: "External" },
      { Format: "ass", Method: "Encode" },
      { Format: "ssa", Method: "Encode" },
      { Format: "pgssub", Method: "Encode" },
      { Format: "dvdsub", Method: "Encode" },
    ],
  };
}

/**
 * An address with the token. `ApiKey` is what Jellyfin 10.9+ expects (12.x rejects the legacy `api_key` on some
 * endpoints, e.g. trickplay); older servers only know `api_key`. Sending both works everywhere — but only once each: a
 * `TranscodingUrl` already carries `ApiKey`, and its HLS playlist answers 401 to a second one (every copy
 * that needed HLS failed to start).
 */
export function withJellyfinKey(url: string, token: string): string {
  const add = ["ApiKey", "api_key"].filter((k) => !new RegExp(`[?&]${k}=`).test(url)).map((k) => `${k}=${encodeURIComponent(token)}`);
  return add.length ? `${url}${url.includes("?") ? "&" : "?"}${add.join("&")}` : url;
}

export function jellyfinClient(base: string, auth: { userId: string; accessToken: string }, opts: { maxBitrateKbps?: number | null; syncProgress?: boolean } = {}): ProviderClient {
  const token = auth.accessToken;
  const call = <T>(path: string, init?: RequestInit) => jf<T>(base, path, token, init);
  const withKey = (path: string) => withJellyfinKey(joinUrl(base, path), token);

  return {
    kind: "jellyfin",
    async test() {
      const t0 = performance.now();
      const info = await call<{ ServerName: string; Version: string }>("/System/Info");
      return { version: `Jellyfin ${info.Version}`, latencyMs: Math.round(performance.now() - t0), serverName: info.ServerName };
    },

    async scan(onProgress: (p: ScanProgress) => void) {
      const entries: LibraryIndexEntry[] = [];
      const pending: { key: string; imdb?: string; tvdb?: number; kind: "movie" | "tv"; externalId: string; label: string | null; quality: LibraryIndexEntry["quality"] }[] = [];
      let start = 0;
      const limit = 500;
      let total: number | null = null;
      while (true) {
        const page = await call<{ Items: JfItem[]; TotalRecordCount: number }>(
          `/Users/${auth.userId}/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds,MediaSources&StartIndex=${start}&Limit=${limit}&EnableImages=false&EnableUserData=false`,
        );
        total = page.TotalRecordCount;
        for (const it of page.Items) {
          const kind = it.Type === "Series" ? "tv" : "movie";
          const tmdb = it.ProviderIds?.Tmdb ?? it.ProviderIds?.tmdb;
          const src = it.MediaSources?.[0];
          const v = src?.MediaStreams.find((s) => s.Type === "Video");
          const quality: LibraryIndexEntry["quality"] = src
            ? {
                // Classify by the larger of width-implied and actual height (2.39:1 films are 1920×800).
                resolution: v?.Height ? resolutionLabel(v.Width ?? 0, v.Height) : null,
                videoCodec: v?.Codec ?? null,
                // "atmos" after the codecs when a track says Dolby Atmos in its profile or title (the quality marks).
                audioCodecs: [
                  ...src.MediaStreams.filter((s) => s.Type === "Audio").map((s) => s.Codec ?? "").filter(Boolean),
                  ...(src.MediaStreams.some((s) => s.Type === "Audio" && /atmos/i.test(`${s.Profile ?? ""} ${s.DisplayTitle ?? ""}`)) ? ["atmos"] : []),
                ].slice(0, 8),
                audioLanguages: audioLanguages(src.MediaStreams.filter((s) => s.Type === "Audio").map((s) => s.Language)),
                // Embedded and external subtitle tracks, for the CC mark.
                subtitleTracks: src.MediaStreams.filter((s) => s.Type === "Subtitle").length,
                // The HDR format by name (DOVI, HDR10Plus, HDR10, HLG) for the quality marks; the range alone otherwise.
                hdr: v?.VideoRangeType && v.VideoRangeType !== "SDR" ? v.VideoRangeType : v?.VideoRange && v.VideoRange !== "SDR" ? v.VideoRange : null,
                container: src.Container ?? null,
                sizeBytes: src.Size ?? null,
              }
            : null;
          if (tmdb && /^\d+$/.test(tmdb)) {
            entries.push({ titleId: `${kind}:${Number(tmdb)}`, externalId: it.Id, season: null, episode: null, label: it.Name, quality });
          } else if (it.ProviderIds?.Imdb || it.ProviderIds?.Tvdb) {
            pending.push({ key: it.Id, imdb: it.ProviderIds.Imdb, tvdb: it.ProviderIds.Tvdb ? Number(it.ProviderIds.Tvdb) : undefined, kind, externalId: it.Id, label: it.Name, quality });
          }
        }
        start += page.Items.length;
        onProgress({ scanned: start, total });
        if (page.Items.length < limit || start >= total) break;
      }
      // Items without a TMDB id are resolved through Lumovio's cached IMDb/TVDB → TMDB mapping.
      const { api } = await import("@/lib/api");
      for (let i = 0; i < pending.length; i += 200) {
        const chunk = pending.slice(i, i + 200);
        const { resolved } = await api<{ resolved: Record<string, string | null> }>("/api/catalog/resolve", {
          method: "POST",
          json: { items: chunk.map((p) => ({ key: p.key, imdb: p.imdb, tvdb: p.tvdb, kind: p.kind })) },
        });
        for (const p of chunk) {
          const tid = resolved[p.key];
          if (tid) entries.push({ titleId: tid as LibraryIndexEntry["titleId"], externalId: p.externalId, season: null, episode: null, label: p.label, quality: p.quality });
        }
      }
      // A series has no file of its own: the audio languages and subtitles of its first few episodes stand for it (four
      // series at a time). One that doesn't answer keeps none; the scan goes on.
      const shows = entries.filter((e) => e.titleId.startsWith("tv:"));
      for (let i = 0; i < shows.length; i += 4) {
        await Promise.all(
          shows.slice(i, i + 4).map(async (e) => {
            const eps = await optional(
              call<{ Items: JfItem[] }>(`/Shows/${e.externalId}/Episodes?UserId=${auth.userId}&Fields=MediaStreams&Limit=3&EnableImages=false&EnableUserData=false`),
              null,
            );
            const langs = audioLanguages((eps?.Items ?? []).flatMap((x) => (x.MediaStreams ?? []).filter((s) => s.Type === "Audio").map((s) => s.Language)));
            if (langs.length > 0) e.quality = { ...(e.quality ?? {}), audioLanguages: langs };
            // Subtitles in its first episodes stand for it too (the CC mark).
            if (eps) e.quality = { ...(e.quality ?? {}), subtitleTracks: Math.max(0, ...eps.Items.map((x) => (x.MediaStreams ?? []).filter((s) => s.Type === "Subtitle").length)) };
          }),
        );
      }
      return entries;
    },

    /**
     * What this sign-in has played (Import history): every film and episode Jellyfin marks played, with the day
     * last played; an episode with its series' name, year and ids. Resume positions are left on the server.
     */
    async history(onProgress: (p: ScanProgress) => void) {
      const played: JfItem[] = [];
      let start = 0;
      const limit = 500;
      while (true) {
        const page = await call<{ Items: JfItem[]; TotalRecordCount: number }>(
          `/Users/${auth.userId}/Items?Recursive=true&IncludeItemTypes=Movie,Episode&Filters=IsPlayed&Fields=ProviderIds,ProductionYear&StartIndex=${start}&Limit=${limit}&EnableImages=false&EnableUserData=true`,
        );
        played.push(...page.Items);
        start += page.Items.length;
        onProgress({ scanned: start, total: page.TotalRecordCount });
        if (page.Items.length < limit || start >= page.TotalRecordCount) break;
      }
      const seriesIds = [...new Set(played.flatMap((it) => (it.Type === "Episode" && it.SeriesId ? [it.SeriesId] : [])))];
      const series = new Map<string, JfItem>();
      for (let i = 0; i < seriesIds.length; i += 100) {
        const r = await call<{ Items: JfItem[] }>(`/Users/${auth.userId}/Items?Ids=${seriesIds.slice(i, i + 100).join(",")}&Fields=ProviderIds,ProductionYear&EnableImages=false&EnableUserData=false`);
        for (const s of r.Items) series.set(s.Id, s);
      }
      const ids = (p: Record<string, string> | undefined) => {
        const get = (k: string) => p?.[k] ?? p?.[k.toLowerCase()] ?? p?.[k.toUpperCase()];
        return { tmdb: get("Tmdb"), imdb: get("Imdb"), tvdb: get("Tvdb") };
      };
      return played.flatMap((it): ServerHistory["items"] => {
        if (it.Type === "Movie") return [{ kind: "movie", title: it.Name, year: it.ProductionYear ?? null, ids: ids(it.ProviderIds), season: null, episode: null, watchedAt: it.UserData?.LastPlayedDate ?? null }];
        const show = it.SeriesId ? series.get(it.SeriesId) : undefined;
        if (it.Type !== "Episode" || !show || it.ParentIndexNumber === undefined || it.IndexNumber === undefined) return [];
        return [{ kind: "episode", title: show.Name, year: show.ProductionYear ?? null, ids: ids(show.ProviderIds), season: it.ParentIndexNumber, episode: it.IndexNumber, watchedAt: it.UserData?.LastPlayedDate ?? null }];
      });
    },

    async findEpisode(seriesId, season, episode) {
      const r = await call<{ Items: JfItem[] }>(`/Shows/${seriesId}/Episodes?UserId=${auth.userId}&Season=${season}&Fields=MediaSources`);
      return r.Items.find((e) => e.ParentIndexNumber === season && e.IndexNumber === episode)?.Id ?? null;
    },

    async prepare(itemId, o) {
      const caps = detectCapabilities();
      const maxBitrate = (opts.maxBitrateKbps ?? 120_000) * 1000;
      const fetchInfo = (allowDirectPlay: boolean) =>
        call<{ MediaSources: JfMediaSource[]; PlaySessionId: string }>(`/Items/${itemId}/PlaybackInfo?UserId=${auth.userId}`, {
          method: "POST",
          body: JSON.stringify({
            DeviceProfile: deviceProfile(caps, maxBitrate),
            MaxStreamingBitrate: maxBitrate,
            StartTimeTicks: Math.round((o.startSec ?? 0) * TICKS),
            AudioStreamIndex: o.audioIndex,
            EnableDirectPlay: allowDirectPlay,
            EnableDirectStream: true,
            EnableTranscoding: true,
            AllowVideoStreamCopy: true,
            AllowAudioStreamCopy: true,
            AutoOpenLiveStream: true,
          }),
        });
      let info = await fetchInfo(true);
      const src = info.MediaSources[0];
      if (!src) throw new Error("Jellyfin returned no media source");
      const v = src.MediaStreams.find((s) => s.Type === "Video");
      const audioStreams = src.MediaStreams.filter((s) => s.Type === "Audio");
      const defaultAudio = audioStreams.find((s) => s.Index === o.audioIndex) ?? audioStreams.find((s) => s.IsDefault) ?? audioStreams[0];
      const audio: AudioOption[] = audioStreams.map((s) => ({
        index: s.Index,
        // The track's own title ("Dub (Пифагор)") over Jellyfin's composed one ("Rus - AAC - Stereo - Default"): the player
        // says the language and format itself.
        label: s.Title ?? s.DisplayTitle ?? s.Language ?? `#${s.Index}`,
        lang: s.Language ?? null,
        codec: s.Codec ?? null,
        isDefault: s.Index === defaultAudio?.Index,
      }));
      const subtitles: SubtitleTrack[] = src.MediaStreams.filter((s) => s.Type === "Subtitle" && (s.DeliveryMethod === "External" || s.IsTextSubtitleStream)).map((s) => ({
        id: String(s.Index),
        lang: s.Language ?? "und",
        label: s.DisplayTitle ?? s.Language ?? `#${s.Index}`,
        url: s.DeliveryUrl ? withKey(s.DeliveryUrl) : withKey(`/Videos/${itemId}/${src.Id}/Subtitles/${s.Index}/0/Stream.vtt`),
        kind: "subtitles",
      }));

      // Prefer Direct Play when our own codec check agrees with Jellyfin's verdict.
      const local = canDirectPlay(caps, { container: src.Container, videoCodec: v?.Codec ?? null, audioCodec: defaultAudio?.Codec ?? null, bitDepth: v?.BitDepth ?? null });
      let url: string;
      let type: PreparedPlayback["type"] = "progressive";
      let method: PreparedPlayback["method"];
      let methodNote: string | null = null;
      const staticUrl = withKey(`/Videos/${itemId}/stream?static=true&mediaSourceId=${src.Id}&PlaySessionId=${info.PlaySessionId}&DeviceId=${deviceId()}`);
      if (src.SupportsDirectPlay && local.ok && (o.audioIndex === undefined || o.audioIndex === defaultAudio?.Index)) {
        url = staticUrl;
        method = "direct";
      } else {
        // Jellyfin 12.2 can report Direct Play for files our own codec check rejects (e.g. MKV with
        // AC3 audio in Chrome → silent video). Our verdict wins: ask again without Direct Play to
        // obtain an HLS stream (video copied, audio transcoded when possible).
        let tsrc = src;
        if (!tsrc.TranscodingUrl) {
          info = await fetchInfo(false);
          tsrc = info.MediaSources[0] ?? src;
        }
        if (!tsrc.TranscodingUrl) throw new Error(`Jellyfin offered no compatible stream (${local.ok ? "unknown" : local.reason})`);
        url = withKey(tsrc.TranscodingUrl);
        type = "hls";
        const reasons = tsrc.TranscodeReasons ?? [];
        method = !reasons.some((r) => /Video/i.test(r)) && v && canDirectPlay(caps, { container: "mp4", videoCodec: v.Codec ?? null, audioCodec: null, bitDepth: v.BitDepth ?? null }).ok ? "remux" : "transcode";
        methodNote = reasons.length ? reasons.join(", ") : local.ok ? null : local.reason;
      }

      const durationSec = src.RunTimeTicks ? src.RunTimeTicks / TICKS : null;
      // Optional extras; playback never waits on or fails because of them.
      const [meta, segs] = await Promise.all([
        optional(call<{ Trickplay?: Record<string, Record<string, JfTrickplay>> }>(`/Users/${auth.userId}/Items/${itemId}?Fields=Trickplay`), null),
        optional(call<{ Items: { Type: string; StartTicks: number; EndTicks: number }[] }>(`/MediaSegments/${itemId}`), null),
      ]);
      const tp = pickTrickplay(meta?.Trickplay, src.Id);
      const playMethod = method === "direct" ? "DirectPlay" : method === "remux" ? "DirectStream" : "Transcode";
      const report = (path: string, positionSec: number, paused = false) => {
        if (!opts.syncProgress) return;
        // The server's own progress report: the next one carries the position again.
        background(
          call(path, {
            method: "POST",
            body: JSON.stringify({
              ItemId: itemId,
              MediaSourceId: src.Id,
              PlaySessionId: info.PlaySessionId,
              PositionTicks: Math.round(positionSec * TICKS),
              IsPaused: paused,
              PlayMethod: playMethod,
              AudioStreamIndex: defaultAudio?.Index,
              CanSeek: true,
            }),
            keepalive: true,
          }),
        );
      };
      const self = this as ProviderClient;
      return {
        url,
        type,
        mime: type === "hls" ? "application/vnd.apple.mpegurl" : null,
        // Its HLS playlist always lists the whole film (StartTimeTicks only starts the transcode there): without a seek
        // a resume, a source switch or another audio track started over at 0:00.
        seekToStart: type === "hls",
        method,
        methodNote,
        subtitles,
        audio,
        selectAudio: (index: number) => self.prepare(itemId, { ...o, audioIndex: index }),
        durationSec,
        externalUrl: staticUrl,
        incompatibility: local.ok ? null : local.reason,
        segments: segs ? parseSegments(segs.Items ?? []) : [],
        trickplay: tp
          ? {
              tileUrl: (i: number) => withKey(`/Videos/${itemId}/Trickplay/${tp.key}/${i}.jpg?mediaSourceId=${src.Id}`),
              width: tp.Width,
              height: tp.Height,
              cols: tp.TileWidth,
              rows: tp.TileHeight,
              count: tp.ThumbnailCount,
              intervalMs: tp.Interval,
            }
          : null,
        info: { container: src.Container, videoCodec: v?.Codec ?? null, audioCodec: defaultAudio?.Codec ?? null, width: v?.Width ?? null, height: v?.Height ?? null, bitrate: src.Bitrate ?? null },
        reportStart: (p) => report("/Sessions/Playing", p),
        reportProgress: (p, paused) => report("/Sessions/Playing/Progress", p, paused),
        reportStop: (p) => report("/Sessions/Playing/Stopped", p),
      };
    },
  };
}
