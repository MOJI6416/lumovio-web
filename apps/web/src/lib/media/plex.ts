import type { LibraryIndexEntry, ServerHistory } from "@lumovio/contracts";
import { canDirectPlay, detectCapabilities } from "./capabilities";
import { background, optional } from "../optional";
import { audioLanguages } from "./languages";
import { deviceId, joinUrl, mediaFetch } from "./net";
import type { MediaSegment, AudioOption, PreparedPlayback, ProviderClient, ScanProgress, SubtitleTrack } from "./types";
import { randomId } from "../random-id";

/**
 * Plex client built from Plex's public developer documentation (PIN auth, resources, library,
 * universal transcoder, timeline). NOT yet verified against a live Plex Media Server.
 */
const PRODUCT = "Lumovio";

function plexHeaders(token?: string): Record<string, string> {
  return {
    Accept: "application/json",
    "X-Plex-Product": PRODUCT,
    "X-Plex-Version": "0.1.0",
    "X-Plex-Client-Identifier": deviceId(),
    "X-Plex-Platform": "Web",
    "X-Plex-Device": "Browser",
    ...(token ? { "X-Plex-Token": token } : {}),
  };
}

export async function plexStartPin(): Promise<{ id: number; code: string; authUrl: string }> {
  const res = await mediaFetch("https://plex.tv/api/v2/pins?strong=true", { method: "POST", headers: plexHeaders() });
  const pin = (await res.json()) as { id: number; code: string };
  const params = new URLSearchParams({
    clientID: deviceId(),
    code: pin.code,
    "context[device][product]": PRODUCT,
  });
  return { id: pin.id, code: pin.code, authUrl: `https://app.plex.tv/auth#?${params}` };
}

export async function plexPollPin(id: number): Promise<string | null> {
  const res = await mediaFetch(`https://plex.tv/api/v2/pins/${id}`, { headers: plexHeaders() });
  const pin = (await res.json()) as { authToken: string | null };
  return pin.authToken ?? null;
}

export interface PlexResource {
  name: string;
  clientIdentifier: string;
  accessToken: string;
  provides: string;
  connections: { uri: string; local: boolean; relay: boolean; protocol: string }[];
}

export async function plexResources(authToken: string): Promise<PlexResource[]> {
  const res = await mediaFetch("https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1", { headers: plexHeaders(authToken) });
  const all = (await res.json()) as PlexResource[];
  return all.filter((r) => r.provides.includes("server"));
}

/** First connection that answers from this device: HTTPS plex.direct before relays. */
export async function plexPickConnection(r: PlexResource): Promise<string | null> {
  const ordered = [...r.connections].sort((a, b) => Number(a.relay) - Number(b.relay) || Number(b.protocol === "https") - Number(a.protocol === "https") || Number(b.local) - Number(a.local));
  for (const c of ordered) {
    try {
      await mediaFetch(joinUrl(c.uri, "/identity"), { headers: plexHeaders(r.accessToken), timeoutMs: 4000 });
      return c.uri;
    } catch {
      /* try next */
    }
  }
  return null;
}

interface PlexStream {
  id: number;
  streamType: 1 | 2 | 3; // video, audio, subtitle
  codec: string;
  language?: string;
  languageCode?: string;
  /** BCP 47 ("ru"), on newer servers. */
  languageTag?: string;
  displayTitle?: string;
  selected?: boolean;
  default?: boolean;
  key?: string;
  bitDepth?: number;
  height?: number;
}

interface PlexMetadata {
  ratingKey: string;
  title: string;
  type: "movie" | "show" | "episode";
  parentIndex?: number;
  index?: number;
  duration?: number;
  Guid?: { id: string }[];
  Media?: { container: string; videoCodec: string; audioCodec: string; videoResolution?: string; width?: number; height?: number; bitrate?: number; Part: { key: string; size?: number; Stream?: PlexStream[] }[] }[];
  /** Intro / credits markers (Plex Pass analysis), present with includeMarkers=1. */
  Marker?: { type: string; startTimeOffset: number; endTimeOffset: number }[];
  year?: number;
  /** Times played to the end and the last time (Unix seconds), for the signed-in account. */
  viewCount?: number;
  lastViewedAt?: number;
  /** An episode's show. */
  grandparentRatingKey?: string;
  grandparentTitle?: string;
}

/** Plex intro / credits markers → skip segments (offsets are in milliseconds). */
export function plexSegments(markers: PlexMetadata["Marker"]): MediaSegment[] {
  return (markers ?? [])
    .flatMap((x) => {
      const kind = x.type === "intro" ? "intro" : x.type === "credits" ? "outro" : null;
      const start = x.startTimeOffset / 1000;
      const end = x.endTimeOffset / 1000;
      return kind && end - start >= 3 ? [{ kind, start, end } as MediaSegment] : [];
    })
    .sort((a, b) => a.start - b.start);
}

function tmdbFromGuids(guids: { id: string }[] | undefined): number | null {
  const g = guids?.find((x) => x.id.startsWith("tmdb://"));
  return g ? Number(g.id.slice(7)) : null;
}

export function plexClient(serverUrl: string, serverToken: string, opts: { syncProgress?: boolean } = {}): ProviderClient {
  const call = async <T>(path: string, init: RequestInit = {}) =>
    (await (await mediaFetch(joinUrl(serverUrl, path), { ...init, headers: { ...plexHeaders(serverToken), ...(init.headers ?? {}) } })).json()) as T;
  const tokenParam = `X-Plex-Token=${encodeURIComponent(serverToken)}`;

  return {
    kind: "plex",
    async test() {
      const t0 = performance.now();
      const r = await call<{ MediaContainer: { friendlyName: string; version: string } }>("/");
      return { version: `Plex ${r.MediaContainer.version}`, latencyMs: Math.round(performance.now() - t0), serverName: r.MediaContainer.friendlyName };
    },
    async scan(onProgress: (p: ScanProgress) => void) {
      const sections = await call<{ MediaContainer: { Directory: { key: string; type: string }[] } }>("/library/sections");
      const entries: LibraryIndexEntry[] = [];
      let scanned = 0;
      for (const s of sections.MediaContainer.Directory.filter((d) => d.type === "movie" || d.type === "show")) {
        const items = await call<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(`/library/sections/${s.key}/all?includeGuids=1`);
        for (const m of items.MediaContainer.Metadata ?? []) {
          const tmdb = tmdbFromGuids(m.Guid);
          scanned++;
          if (!tmdb) continue;
          const media = m.Media?.[0];
          entries.push({
            titleId: `${m.type === "show" ? "tv" : "movie"}:${tmdb}`,
            externalId: m.ratingKey,
            season: null,
            episode: null,
            label: m.title,
            quality: media ? { resolution: media.videoResolution ? `${media.videoResolution}p`.replace("4kp", "2160p") : null, videoCodec: media.videoCodec, audioCodecs: [media.audioCodec], hdr: null, container: media.container, sizeBytes: media.Part[0]?.size ?? null } : null,
          });
        }
        onProgress({ scanned, total: null });
      }
      // A section's list gives no streams: each film's own metadata does, a show's through its first episode (six at a
      // time; not checked against a real Plex server). One that doesn't answer keeps none.
      const streamsOf = async (key: string) =>
        (await call<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(`/library/metadata/${key}`)).MediaContainer.Metadata?.[0]?.Media?.[0]?.Part[0]?.Stream ?? [];
      for (let i = 0; i < entries.length; i += 6) {
        await Promise.all(
          entries.slice(i, i + 6).map(async (e) => {
            const streams = await optional(
              (async () => {
                if (e.titleId.startsWith("movie:")) return streamsOf(e.externalId);
                const leaves = await call<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(`/library/metadata/${e.externalId}/allLeaves?X-Plex-Container-Start=0&X-Plex-Container-Size=1`);
                const first = leaves.MediaContainer.Metadata?.[0];
                return first ? streamsOf(first.ratingKey) : [];
              })(),
              [] as PlexStream[],
            );
            const langs = audioLanguages(streams.filter((s) => s.streamType === 2).map((s) => s.languageCode ?? s.languageTag ?? null));
            if (langs.length > 0) e.quality = { ...(e.quality ?? {}), audioLanguages: langs };
            // Plex's subtitle streams (type 3), for the CC mark; none read when the item didn't answer.
            if (streams.length > 0) e.quality = { ...(e.quality ?? {}), subtitleTracks: streams.filter((s) => s.streamType === 3).length };
          }),
        );
      }
      return entries;
    },
    /**
     * What the Plex account has played on this server (Import history, C134; built from Plex's documentation, not
     * checked against a real server): films and episodes with a view count, with the last time played; an episode with
     * its show's name, year and ids.
     */
    async history(onProgress: (p: ScanProgress) => void) {
      const sections = await call<{ MediaContainer: { Directory: { key: string; type: string }[] } }>("/library/sections");
      const out: ServerHistory["items"] = [];
      const ids = (guids: { id: string }[] | undefined) => {
        const of = (scheme: string) => guids?.find((g) => g.id.startsWith(`${scheme}://`))?.id.slice(scheme.length + 3);
        return { tmdb: of("tmdb"), imdb: of("imdb"), tvdb: of("tvdb") };
      };
      const when = (m: PlexMetadata) => (m.lastViewedAt ? new Date(m.lastViewedAt * 1000).toISOString() : null);
      for (const s of sections.MediaContainer.Directory) {
        if (s.type === "movie") {
          const films = await call<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(`/library/sections/${s.key}/all?type=1&includeGuids=1`);
          for (const m of films.MediaContainer.Metadata ?? []) {
            if ((m.viewCount ?? 0) > 0) out.push({ kind: "movie", title: m.title, year: m.year ?? null, ids: ids(m.Guid), season: null, episode: null, watchedAt: when(m) });
          }
        } else if (s.type === "show") {
          const shows = await call<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(`/library/sections/${s.key}/all?type=2&includeGuids=1`);
          const byKey = new Map((shows.MediaContainer.Metadata ?? []).map((m) => [m.ratingKey, m]));
          const eps = await call<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(`/library/sections/${s.key}/all?type=4`);
          for (const e of eps.MediaContainer.Metadata ?? []) {
            const show = e.grandparentRatingKey ? byKey.get(e.grandparentRatingKey) : undefined;
            if ((e.viewCount ?? 0) === 0 || !show || e.parentIndex === undefined || e.index === undefined) continue;
            out.push({ kind: "episode", title: show.title, year: show.year ?? null, ids: ids(show.Guid), season: e.parentIndex, episode: e.index, watchedAt: when(e) });
          }
        }
        onProgress({ scanned: out.length, total: null });
      }
      return out;
    },

    async findEpisode(showKey, season, episode) {
      const r = await call<{ MediaContainer: { Metadata?: PlexMetadata[] } }>(`/library/metadata/${showKey}/allLeaves`);
      return r.MediaContainer.Metadata?.find((e) => e.parentIndex === season && e.index === episode)?.ratingKey ?? null;
    },
    async prepare(ratingKey, o) {
      const meta = await call<{ MediaContainer: { Metadata: PlexMetadata[] } }>(`/library/metadata/${ratingKey}?includeMarkers=1`);
      const m = meta.MediaContainer.Metadata[0];
      const media = m?.Media?.[0];
      const part = media?.Part[0];
      if (!m || !media || !part) throw new Error("Plex returned no media");
      const caps = detectCapabilities();
      const streams = part.Stream ?? [];
      const v = streams.find((s) => s.streamType === 1);
      const audioStreams = streams.filter((s) => s.streamType === 2);
      const chosenAudio = audioStreams.find((s) => s.id === o.audioIndex) ?? audioStreams.find((s) => s.selected) ?? audioStreams[0];
      const verdict = canDirectPlay(caps, { container: media.container, videoCodec: media.videoCodec, audioCodec: chosenAudio?.codec ?? media.audioCodec, bitDepth: v?.bitDepth ?? null });
      const direct = `${joinUrl(serverUrl, part.key)}?${tokenParam}`;
      const session = randomId();
      const transcode = `${joinUrl(serverUrl, "/video/:/transcode/universal/start.m3u8")}?${new URLSearchParams({
        path: `/library/metadata/${ratingKey}`,
        protocol: "hls",
        directPlay: "0",
        directStream: "1",
        directStreamAudio: "1",
        fastSeek: "1",
        offset: String(Math.floor(o.startSec ?? 0)),
        session,
        "X-Plex-Client-Identifier": deviceId(),
        "X-Plex-Product": PRODUCT,
        "X-Plex-Platform": "Chrome",
        ...(o.audioIndex !== undefined ? { audioStreamID: String(o.audioIndex) } : {}),
      })}&${tokenParam}`;
      const subtitles: SubtitleTrack[] = streams
        .filter((s) => s.streamType === 3 && s.key)
        .map((s) => ({ id: String(s.id), lang: s.languageCode ?? "und", label: s.displayTitle ?? s.language ?? `#${s.id}`, url: `${joinUrl(serverUrl, s.key!)}?${tokenParam}&format=vtt`, kind: "subtitles" as const }));
      const audio: AudioOption[] = audioStreams.map((s) => ({ index: s.id, label: s.displayTitle ?? s.language ?? `#${s.id}`, lang: s.languageCode ?? null, codec: s.codec, isDefault: s === chosenAudio }));
      const useDirect = verdict.ok && o.audioIndex === undefined;
      const timeline = (state: "playing" | "paused" | "stopped", sec: number) => {
        if (!opts.syncProgress) return;
        // The server's own progress report: the next one carries the position again.
        background(
          mediaFetch(
            `${joinUrl(serverUrl, "/:/timeline")}?ratingKey=${ratingKey}&key=/library/metadata/${ratingKey}&state=${state}&time=${Math.round(sec * 1000)}&duration=${m.duration ?? 0}&${tokenParam}`,
            { headers: plexHeaders(serverToken), keepalive: true },
          ),
        );
      };
      const self = this as ProviderClient;
      return {
        url: useDirect ? direct : transcode,
        type: useDirect ? "progressive" : "hls",
        mime: useDirect ? null : "application/vnd.apple.mpegurl",
        method: useDirect ? "direct" : verdict.ok ? "remux" : "transcode",
        methodNote: verdict.ok ? null : verdict.reason,
        subtitles,
        audio,
        selectAudio: (index: number) => self.prepare(ratingKey, { ...o, audioIndex: index }),
        durationSec: m.duration ? m.duration / 1000 : null,
        externalUrl: direct,
        incompatibility: verdict.ok ? null : verdict.reason,
        segments: plexSegments(m.Marker),
        info: { container: media.container, videoCodec: media.videoCodec, audioCodec: chosenAudio?.codec ?? media.audioCodec, width: media.width ?? null, height: media.height ?? null, bitrate: media.bitrate ? media.bitrate * 1000 : null },
        reportStart: (p) => timeline("playing", p),
        reportProgress: (p, paused) => timeline(paused ? "paused" : "playing", p),
        reportStop: (p) => timeline("stopped", p),
      } satisfies PreparedPlayback;
    },
  };
}
