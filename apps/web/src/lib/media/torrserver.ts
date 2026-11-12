import { canRemuxInBrowser, detectCapabilities } from "./capabilities";
import { optional } from "../optional";
import { joinUrl, MediaNetError, mediaFetch, targetAddressSpace } from "./net";
import { profileTrack, type VoiceWish, voiceTrack } from "./releases";
import type { AudioOption, MediaSegment, PreparedPlayback, ProviderClient, SubtitleTrack } from "./types";

/** A chapter as ffprobe gives it (`-show_chapters`; seconds as strings). */
export interface ProbeChapter {
  start_time?: string;
  end_time?: string;
  tags?: { title?: string };
}

const CHAPTER_KIND: [MediaSegment["kind"], RegExp][] = [
  ["intro", /^(?:intro|opening|op|opening credits|заставка|вступление|опенинг|начальные титры|заставка серии)(?:\s*\d*)?$/iu],
  ["recap", /^(?:recap|previously(?: on)?|ранее|в предыдущих сериях|у попередніх серіях|раніше)(?:\s*\d*)?$/iu],
  ["outro", /^(?:credits|end credits|ending|outro|ed|титры|финальные титры|эндинг|кінцеві титри|титри)(?:\s*\d*)?$/iu],
  ["preview", /^(?:preview|next episode|анонс|превью|в следующей серии)(?:\s*\d*)?$/iu],
];

/**
 * Skip segments from a file's chapters, when they are named so ("Intro", "Opening", "Заставка", "Credits", "Титры"):
 * the same intro / recap / credits marks Jellyfin and Plex give, for a file a TorrServer plays. Other chapters are
 * not segments; nothing is guessed from times alone.
 */
export function chapterSegments(chapters: ProbeChapter[] | undefined): MediaSegment[] {
  const out: MediaSegment[] = [];
  for (const c of chapters ?? []) {
    const title = (c.tags?.title ?? "").trim();
    const kind = CHAPTER_KIND.find(([, re]) => re.test(title))?.[0];
    const start = Number(c.start_time);
    const end = Number(c.end_time);
    if (kind && Number.isFinite(start) && Number.isFinite(end) && end - start >= 3) out.push({ kind, start, end });
  }
  return out;
}

/**
 * TorrServer (MatriX builds) client. TorrServer streams files as-is: no transcoding (unless a
 * -gst build is configured), so the player decides compatibility from ffprobe data and offers an
 * external player otherwise. Requests go straight to the user's TorrServer.
 */
/** The file a source points to is no longer in the torrent (or was never chosen). */
export class TorrentFileMissing extends Error {
  constructor(readonly fileIndex: string) {
    super(fileIndex ? `File #${fileIndex} is not in this torrent any more` : "No file chosen in this torrent");
  }
}

export interface TsAuth {
  username: string | null;
  password: string | null;
}

export interface TsFile {
  id: number;
  path: string;
  length: number;
}

export interface TsTorrent {
  hash: string;
  title: string;
  poster?: string;
  data?: string;
  stat?: number;
  stat_string?: string;
  torrent_size?: number;
  file_stats?: TsFile[];
  active_peers?: number;
  total_peers?: number;
  connected_seeders?: number;
  download_speed?: number;
  preloaded_bytes?: number;
}

export interface TsSearchResult {
  title: string;
  /** What TorrServer can add: a magnet, or a link to the .torrent file (Jackett's /dl/ links). */
  link: string;
  /** Info hash when the indexer gave one (for spotting a torrent that is already added). */
  hash: string | null;
  size: number | null;
  /** The highest any of its indexers reports: one swarm, counted once, never summed across indexers. */
  seeders: number | null;
  peers: number | null;
  tracker: string | null;
  published: string | null;
  /**
   * When several indexers returned the same torrent (same hash): each one's entry with its own link and
   * numbers, the result's own first. Absent for a torrent one indexer returned.
   */
  origins?: TsOrigin[];
}

/** One indexer's entry for a torrent. */
export interface TsOrigin {
  tracker: string | null;
  link: string;
  seeders: number | null;
  peers: number | null;
  published: string | null;
}

/** Every tracker a result came from, its own first. */
export const trackersOf = (r: Pick<TsSearchResult, "tracker" | "origins">) => (r.origins ? r.origins.map((o) => o.tracker) : [r.tracker]);

/** A search answer as it is kept: when it ran, and `emptyAt` when a later refresh came back empty and this one was kept. */
export interface SearchAnswer {
  results: TsSearchResult[];
  skipped: number;
  at: number;
  emptyAt?: number;
}

/**
 * The answer to keep after a refresh of the same search: the new one, unless it is empty while the
 * earlier one wasn't — TorrServer answers an empty list when its indexers fail, so an empty refresh
 * keeps the earlier results (with their own time) and says when the refresh found nothing.
 */
export function keepThroughEmpty(prev: SearchAnswer | null | undefined, next: SearchAnswer): SearchAnswer {
  return next.results.length === 0 && prev && prev.results.length > 0 ? { ...prev, emptyAt: next.at } : next;
}

type RawTorznab = {
  Title?: string;
  Name?: string;
  Magnet?: string;
  Link?: string;
  Hash?: string;
  Size?: number | string;
  Seed?: number;
  Peer?: number;
  Tracker?: string;
  CreateDate?: string;
  PublishDate?: string;
}[];

const ADDABLE = /^(magnet:|https?:\/\/)/i;

/**
 * TorrServer's search answer, normalised. MatriX fills `Magnet` only when the indexer provides one
 * and leaves it as "" otherwise; most Jackett indexers (RuTracker, Kinozal, NoNaMe, Toloka) only
 * give `Link`, a .torrent URL TorrServer can add as well. Taking `Magnet ?? Link` dropped every such
 * result, so only an indexer with magnets (Mazepa) ever showed up. Entries without any usable
 * link are counted, not silently lost.
 *
 * One torrent (one info hash, BEP 3) that several indexers return is one result listing where else it
 * came from, each origin keeping its own link (a fallback for adding it) and numbers; its seeders are
 * the highest one reported, never a sum of the same swarm. Without a hash nothing is taken to be the
 * same release, however alike the names: only an identical link is.
 *
 * An indexer that gives every one of its results the same non-zero seeders and peers (`placeholderTrackers`) doesn't
 * count them — LostFilm's says 1 seeder for each of its releases — so its numbers are unknown, never a weak swarm.
 */
/** Indexers whose 4+ results all report the same non-zero seeders and peers: a filler, not a count. */
function placeholderTrackers(raw: RawTorznab): Set<string> {
  const by = new Map<string, Set<string>>();
  const count = new Map<string, number>();
  for (const r of raw) {
    const tracker = r.Tracker || "";
    if (!tracker) continue;
    count.set(tracker, (count.get(tracker) ?? 0) + 1);
    by.set(tracker, (by.get(tracker) ?? new Set()).add(`${r.Seed}|${r.Peer}`));
  }
  return new Set([...by].filter(([t, seen]) => (count.get(t) ?? 0) >= 4 && seen.size === 1 && !seen.has("0|0") && ![...seen][0]!.startsWith("0|")).map(([t]) => t));
}

export function normalizeTorznab(raw: RawTorznab | null): { results: TsSearchResult[]; skipped: number } {
  const results: TsSearchResult[] = [];
  let skipped = 0;
  const byHash = new Map<string, { result: TsSearchResult; first: TsOrigin }>();
  const links = new Set<string>();
  const placeholder = placeholderTrackers(raw ?? []);
  for (const r of raw ?? []) {
    const title = (r.Title || r.Name || "").trim();
    const link = [r.Magnet, r.Link].find((x): x is string => typeof x === "string" && ADDABLE.test(x));
    if (!title || !link) {
      skipped++;
      continue;
    }
    if (links.has(link)) continue;
    links.add(link);
    const hash = (r.Hash || /xt=urn:btih:([a-z0-9]+)/i.exec(link)?.[1] || "").toLowerCase() || null;
    const counted = !placeholder.has(r.Tracker || "");
    const origin: TsOrigin = {
      tracker: r.Tracker || null,
      link,
      seeders: counted && typeof r.Seed === "number" ? r.Seed : null,
      peers: counted && typeof r.Peer === "number" ? r.Peer : null,
      published: r.PublishDate ?? r.CreateDate ?? null,
    };
    const same = hash ? byHash.get(hash) : undefined;
    if (same) {
      const r0 = same.result;
      r0.origins = [...(r0.origins ?? [same.first]), origin];
      if (origin.seeders !== null && (r0.seeders === null || origin.seeders > r0.seeders)) {
        r0.seeders = origin.seeders;
        r0.peers = origin.peers;
      }
      r0.size ??= parseSize(r.Size);
      continue;
    }
    const result: TsSearchResult = { title, hash, size: parseSize(r.Size), ...origin };
    if (hash) byHash.set(hash, { result, first: origin });
    results.push(result);
  }
  return { results, skipped };
}

const VIDEO_EXT = /\.(mkv|mp4|m4v|avi|mov|webm|ts|m2ts|wmv|mpg|mpeg)$/i;

export function isVideoFile(path: string) {
  return VIDEO_EXT.test(path);
}

/** Samples, trailers and bonus material: never chosen as the film or an episode on their own. */
const EXTRA = /(^|[/\\ ._\-[(])(sample|trailer|featurettes?|extras?|bonus|behind[ ._-]the[ ._-]scenes|deleted[ ._-]scenes|трейлер|бонус|допы|дополнительные материалы)([/\\ ._\-\])]|$)/i;
export function isExtra(path: string) {
  return EXTRA.test(path);
}

/** Lower is better: formats browsers can play directly first. */
const EXT_RANK: Record<string, number> = { mp4: 0, m4v: 0, webm: 1, mkv: 2, mov: 3 };
const extRank = (f: TsFile) => EXT_RANK[f.path.split(".").pop()?.toLowerCase() ?? ""] ?? 9;
const stem = (f: TsFile) => (f.path.split("/").pop() ?? f.path).replace(/\.[^.]+$/, "").toLowerCase();

export type FileChoice = { status: "match"; file: TsFile } | { status: "ambiguous" | "none"; candidates: TsFile[] };

/**
 * The film in a torrent: the biggest file that isn't a sample or extra. Copies of that same file in
 * other formats (same name, other extension) are fine — the browser-playable one wins. Another big
 * video with a different name (a second cut, part 2) makes it a question for the person. In that question the files
 * that name the film's `year` come first (a trilogy's "The.Matrix.1999…" before "…Reloaded.2003…").
 */
export function pickMovieFile(files: TsFile[], year?: number | null): FileChoice {
  const videos = files.filter((f) => isVideoFile(f.path) && !isExtra(f.path)).sort((a, b) => b.length - a.length);
  const main = videos[0];
  if (!main) return { status: "none", candidates: files.filter((f) => isVideoFile(f.path)) };
  const same = videos.filter((f) => stem(f) === stem(main)).sort((a, b) => extRank(a) - extRank(b) || b.length - a.length);
  const rivals = videos.filter((f) => stem(f) !== stem(main) && f.length >= main.length * 0.4);
  if (!rivals.length) return { status: "match", file: same[0]! };
  const names = (f: TsFile) => (year ? new RegExp(`(^|\\D)${year}(\\D|$)`).test(f.path.split("/").pop() ?? "") : false);
  return { status: "ambiguous", candidates: [...videos.filter(names), ...videos.filter((f) => !names(f))] };
}

/** Torznab sizes come as bytes or as TorrServer's humanized text ("19.7 GCiB", "700 MiB"). */
export function parseSize(v: number | string | undefined): number | null {
  if (typeof v === "number") return v > 0 ? v : null;
  const m = /([\d.]+)\s*([KMGT]?)/i.exec(v ?? "");
  if (!m) return null;
  const n = Number(m[1]) * 1024 ** "_KMGT".indexOf((m[2] || "_").toUpperCase());
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export interface EpisodeRef {
  /** null when neither the file, its folders nor the torrent's title say which season it is. */
  season: number | null;
  episode: number;
}

/**
 * The one season a piece of text names ("Season 2", "S02", "Сезон: 2", "2 сезон"), or null when it
 * names none or several ("Сезон 1-3", "S01-S04").
 */
export function seasonOfText(text: string): number | null {
  const found = new Set<number>();
  const range = (a: string, b: string) => {
    for (let n = Number(a); n <= Math.min(Number(b), Number(a) + 50); n++) found.add(n);
  };
  for (const m of text.matchAll(/(?:season|сезон|сезоны|seasons)[\s:._-]*(\d{1,2})(?:\s*[-–~]\s*(\d{1,2}))?/gi)) (m[2] ? range(m[1]!, m[2]) : found.add(Number(m[1])));
  for (const m of text.matchAll(/(\d{1,2})(?:-?(?:й|ий))?[\s._-]*(?:season|сезон)/gi)) found.add(Number(m[1]));
  for (const m of text.matchAll(/(?<![a-z\d])s(\d{1,2})(?:\s*[-–]\s*s?(\d{1,2}))?(?![\d]|[ ._-]?e\d)/gi)) (m[2] ? range(m[1]!, m[2]) : found.add(Number(m[1])));
  return found.size === 1 ? [...found][0]! : null;
}

/**
 * Season and episode of one file in a series torrent: S01E02, 1x02, "Серия 2", "E02", or a bare
 * leading number ("02. Name.mkv"). The season comes from the file name, else its folders, else the
 * torrent's title (`packSeason`); otherwise it stays unknown rather than being guessed.
 */
export function episodeOf(path: string, packSeason: number | null = null): EpisodeRef | null {
  const parts = path.split(/[/\\]/);
  const name = parts.pop() ?? path;
  const full = /(?<![a-z\d])s(\d{1,2})[ ._-]?e(\d{1,3})(?!\d)/i.exec(name) ?? /(?<!\d)(\d{1,2})x(\d{2,3})(?!\d)/.exec(name);
  if (full) return { season: Number(full[1]), episode: Number(full[2]) };
  const ep =
    /(?:^|[ ._\-[(])(?:e|ep|episode|серия|серія|эпизод|епізод)[ ._-]?(\d{1,3})(?!\d)/i.exec(name) ??
    /(?<!\d)(\d{1,3})[ ._-]*(?:серия|серія|эпизод|епізод)/i.exec(name) ??
    /^(\d{1,3})(?=[ ._\-)\]]|$)/.exec(name.replace(/\.[^.]+$/, ""));
  if (!ep) return null;
  const fromFolders = parts.map(seasonOfText).filter((s): s is number => s !== null).pop() ?? null;
  return { season: seasonOfText(name) ?? fromFolders ?? packSeason, episode: Number(ep[1]) };
}

export interface EpisodeFile extends TsFile {
  parsed: EpisodeRef | null;
  /** The episode number fits but the season is unknown: offered for confirmation, never played on its own. */
  probable: boolean;
}

export type EpisodeChoice = { status: "match"; file: TsFile } | { status: "ambiguous" | "none"; candidates: EpisodeFile[] };

/**
 * The file of one episode in a torrent. Only a file whose season and episode are both known and
 * equal counts as a match; anything less goes to the person to choose. A missing episode is never
 * replaced by the first, the biggest or a neighbouring file.
 */
export function matchEpisode(files: TsFile[], torrentTitle: string, season: number, episode: number): EpisodeChoice {
  const { candidates, exact } = episodeFiles(files, torrentTitle, season, episode);
  if (exact.length === 1) return { status: "match", file: exact[0]! };
  return { status: exact.length > 1 || candidates.some((f) => f.probable) ? "ambiguous" : "none", candidates };
}

/** A torrent's episode files for the person to choose from: the ones that match first, then probable ones, then by name. */
export function episodeFiles(files: TsFile[], torrentTitle: string, season: number, episode: number): { candidates: EpisodeFile[]; exact: EpisodeFile[] } {
  const pack = seasonOfText(torrentTitle);
  const videos = files.filter((f) => isVideoFile(f.path) && !isExtra(f.path));
  const annotated: EpisodeFile[] = videos.map((f) => {
    const parsed = episodeOf(f.path, pack);
    return { ...f, parsed, probable: parsed !== null && parsed.season === null && parsed.episode === episode };
  });
  const exact = annotated.filter((f) => f.parsed?.season === season && f.parsed.episode === episode);
  const order = (f: EpisodeFile) => (exact.includes(f) ? 0 : f.probable ? 1 : 2);
  return { candidates: [...annotated].sort((a, b) => order(a) - order(b) || a.path.localeCompare(b.path, undefined, { numeric: true })), exact };
}

/** What TorrServer's ffprobe (`/ffp`) says about a file — the part a playback uses. */
export interface FileProbe {
  format?: { format_name?: string; duration?: string; bit_rate?: string };
  streams?: {
    index: number;
    codec_type: string;
    codec_name: string;
    tags?: { language?: string; title?: string };
    disposition?: { default?: number };
    bits_per_raw_sample?: string;
    pix_fmt?: string;
    width?: number;
    height?: number;
    side_data_list?: { side_data_type?: string; dv_profile?: number }[];
    color_transfer?: string;
    channels?: number;
  }[];
  chapters?: ProbeChapter[];
}

export function torrServerClient(base: string, auth: TsAuth, opts: { connectionId?: string } = {}): ProviderClient & {
  list(): Promise<TsTorrent[]>;
  quietAdd(link: string, timeoutMs?: number): Promise<TsTorrent>;
  claim(hash: string, title: string, data: Record<string, unknown>, poster?: string | null): Promise<TsTorrent>;
  get(hash: string): Promise<TsTorrent>;
  files(hash: string, load?: boolean, timeoutMs?: number, signal?: AbortSignal): Promise<{ title: string; files: TsFile[] }>;
  readProbe(hash: string, file: TsFile, signal: AbortSignal, timeoutMs?: number): Promise<FileProbe | null>;
  remove(hash: string): Promise<void>;
  search(query: string, signal?: AbortSignal): Promise<{ results: TsSearchResult[]; skipped: number }>;
  streamUrl(hash: string, file: TsFile, viaWorker: boolean): string;
} {
  const authHeader = auth.username ? `Basic ${btoa(unescape(encodeURIComponent(`${auth.username}:${auth.password ?? ""}`)))}` : null;
  const headers = (json = false): HeadersInit => ({ ...(authHeader ? { Authorization: authHeader } : {}), ...(json ? { "Content-Type": "application/json" } : {}) });
  const post = async <T>(path: string, body: unknown, timeoutMs?: number): Promise<T> => {
    const res = await mediaFetch(joinUrl(base, path), { method: "POST", headers: headers(true), body: JSON.stringify(body), timeoutMs });
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  };
  const get = async <T>(path: string, timeoutMs?: number, signal?: AbortSignal): Promise<T> =>
    (await (await mediaFetch(joinUrl(base, path), { headers: headers(), timeoutMs, signal: signal && typeof AbortSignal.any === "function" ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs ?? 12_000)]) : signal })).json()) as T;

  const streamUrl = (hash: string, file: TsFile, viaWorker: boolean) => {
    const name = encodeURIComponent(file.path.split("/").pop() ?? "video");
    const q = `link=${hash}&index=${file.id}&play`;
    // With credentials, the browser can't attach Basic auth to <video>; the service worker does,
    // via a same-origin virtual path it rewrites to this server.
    if (viaWorker && authHeader && opts.connectionId) return `/__ts/${opts.connectionId}/stream/${name}?${q}`;
    return joinUrl(base, `/stream/${name}?${q}`);
  };

  const externalUrl = (hash: string, file: TsFile) => {
    const u = new URL(joinUrl(base, `/stream/${encodeURIComponent(file.path.split("/").pop() ?? "video")}?link=${hash}&index=${file.id}&play`));
    if (auth.username) {
      u.username = auth.username;
      u.password = auth.password ?? "";
    }
    return u.toString();
  };

  const client = {
    kind: "torrserver" as const,
    async test() {
      const t0 = performance.now();
      const res = await mediaFetch(joinUrl(base, "/echo"), { headers: headers() });
      const version = (await res.text()).trim();
      // /echo is public on TorrServer; verify credentials against an authenticated endpoint.
      await post("/torrents", { action: "list" });
      return { version: `TorrServer ${version}`, latencyMs: Math.round(performance.now() - t0), serverName: null };
    },
    list: () => post<TsTorrent[]>("/torrents", { action: "list" }),
    get: (hash: string) => post<TsTorrent>("/torrents", { action: "get", hash }),
    /**
     * The torrent's files. One restored from TorrServer's database may not have them yet; /stream?stat starts it and waits
     * for the metadata — unless `load` is false (a look through other torrents: none is started for it).
     */
    async files(hash: string, load = true, timeoutMs = 60_000, signal?: AbortSignal) {
      let t = await post<TsTorrent>("/torrents", { action: "get", hash });
      if (!t?.file_stats?.length && load) t = await get<TsTorrent>(`/stream?link=${hash}&stat`, timeoutMs, signal);
      return { title: t?.title ?? "", files: t?.file_stats ?? [] };
    },
    /**
     * Adds a torrent without naming or saving it. `link`: a magnet or a .torrent URL; TorrServer fetches the file itself,
     * which a slow tracker stretches well past the usual 12 s. A torrent already in the server's database keeps its own
     * title, poster and data — an add that brings them rewrites it (MatriX.147).
     */
    quietAdd: (link: string, timeoutMs = 60_000) => post<TsTorrent>("/torrents", { action: "add", link, title: "", poster: "", data: "", save_to_db: false }, timeoutMs),
    /**
     * Names a torrent `quietAdd` brought and keeps it in the server's database: `set` gives the loaded torrent its title,
     * poster and Lumovio's mark, and an add by its hash's magnet saves it without fetching the .torrent again.
     */
    async claim(hash: string, title: string, data: Record<string, unknown>, poster?: string | null) {
      const named = { title, poster: poster ?? "", data: JSON.stringify({ lumovio: data }) };
      await post("/torrents", { action: "set", hash, ...named });
      return post<TsTorrent>("/torrents", { action: "add", link: `magnet:?xt=urn:btih:${hash}`, ...named, save_to_db: true });
    },
    async remove(hash: string) {
      await post("/torrents", { action: "rem", hash });
    },
    async search(query: string, signal?: AbortSignal) {
      const q = `?query=${encodeURIComponent(query)}`;
      // MatriX serves "/torznab/search/" and 301-redirects the slash-less path without CORS
      // headers, which the browser reports as a CORS failure. Other builds may use the bare path.
      const raw = await get<RawTorznab | null>(`/torznab/search/${q}`, 45_000, signal).catch((e) => {
        if (e instanceof MediaNetError && e.code === "cors") return get<RawTorznab | null>(`/torznab/search${q}`, 45_000, signal);
        throw e;
      });
      return normalizeTorznab(raw);
    },
    streamUrl,
    /**
     * What a file holds, read through the server without a playback (a read ahead): a Matroska file's own first
     * kilobytes, else TorrServer's ffprobe. Null when neither told within `timeoutMs`.
     */
    async readProbe(hash: string, file: TsFile, signal: AbortSignal, timeoutMs = 30_000) {
      const within = typeof AbortSignal.any === "function" ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : signal;
      const raw = { url: streamUrl(hash, file, false), headers: (authHeader ? { Authorization: authHeader } : {}) as Record<string, string>, targetAddressSpace: targetAddressSpace(base) };
      const own = /\.(mkv|mk3d|webm)$/i.test(file.path) ? await optional(import("./matroska-probe").then((m) => m.serverFileProbe(raw, file.length, within)), null) : null;
      if (own || within.aborted) return own;
      return optional(get<FileProbe>(`/ffp/${hash}/${file.id}`, timeoutMs, signal), null).then((p) => (p?.streams?.length ? p : null));
    },

    /**
     * externalId = "<hash>:<fileIndex>"; the caller has already chosen the file (`pickMovieFile`,
     * `matchEpisode` or the person). A file the browser can't play as it is — AC-3/E-AC-3 audio, or
     * Matroska where the browser has no Matroska — is rebuilt in the browser when it can be ("remux");
     * so is any audio track other than the file's default, which a plain stream can't choose. A dubbing
     * chosen with the release (`voice`) plays the track that credits it, when one can be told to; with nothing chosen,
     * the track the profile's languages and studios find first (`profileTrack`), else the file's default.
     */
    async prepare(externalId: string, choice: { audioIndex?: number; voice?: VoiceWish | null; profile?: { languages: string[]; studios: string[] } | null; rebuild?: boolean; signal?: AbortSignal } = {}) {
      // A cancelled or replaced preparation stops its requests to the server, not only its next step.
      const signal = choice.signal;
      const [hash, idx] = externalId.split(":");
      if (!hash) throw new Error("Bad torrent id");
      // What this device remembers of its files' probes: loaded only by a playback, alongside the server's first answer.
      const memory = import("./probe-memory");
      // Ask TorrServer to start the torrent (preload metadata), then take exactly the chosen file.
      const t = await get<TsTorrent>(`/stream?link=${hash}&stat`, 60_000, signal);
      const file = (t.file_stats ?? []).find((f) => String(f.id) === idx && isVideoFile(f.path));
      if (!file) throw new TorrentFileMissing(idx ?? "");

      const caps = detectCapabilities();
      const raw: { url: string; headers: Record<string, string>; targetAddressSpace?: "loopback" | "local" } = { url: streamUrl(hash, file, false), headers: authHeader ? { Authorization: authHeader } : {}, targetAddressSpace: targetAddressSpace(base) };
      // The server's subtitle list is asked alongside the probe, not after it.
      const subsAsked = optional(get<{ index?: number; id?: number; name?: string; path?: string; lang?: string }[]>(`/subs/${hash}/${file.id}`, 20_000, signal), null);
      const probeKey = `${hash.toLowerCase()}:${file.id}`;
      const { rememberedProbe, rememberProbe } = await memory;
      let probe: FileProbe | null = rememberedProbe(probeKey);
      // Read now, not remembered: the player shares it (lib/media/release-files).
      let fresh = false;
      if (!probe) {
        const matroska = /\.(mkv|mk3d|webm)$/i.test(file.path);
        // A Matroska file where this browser has no Matroska (an iPhone) is rebuilt whatever the probe says: the rebuild
        // reads the file's head and index meanwhile, instead of after it (~2 s on a phone).
        if (matroska && caps.containers.mkv === "no" && caps.mediaSource !== "none") void import("./remux").then((m) => m.preopen(raw), () => undefined);
        const ask = () =>
          optional(get<FileProbe>(`/ffp/${hash}/${file.id}`, 60_000, signal), null).then((p) => {
            if (p?.streams?.length) rememberProbe(probeKey, p);
            return p;
          });
        // A Matroska file says what a playback takes from TorrServer's ffprobe in its first kilobytes — a read or two, where
        // ffprobe reads megabytes from the start and the end: ffprobe is asked only for what they leave unknown (in the
        // background, for the next start), and waited for when they can't tell (another container, a codec they don't name).
        const own = matroska ? await optional(import("./matroska-probe").then((m) => m.serverFileProbe(raw, file.length, signal ?? new AbortController().signal)), null) : null;
        signal?.throwIfAborted();
        if (own) {
          rememberProbe(probeKey, own);
          if (!own.format?.duration || !own.chapters) void ask();
          probe = own;
        } else probe = await ask();
        signal?.throwIfAborted();
        fresh = Boolean(probe?.streams?.length);
      }
      const vs = probe?.streams?.find((s) => s.codec_type === "video");
      const as = probe?.streams?.filter((s) => s.codec_type === "audio") ?? [];
      const defaultAudio = as.find((s) => s.disposition?.default) ?? as[0];
      const container = probe?.format?.format_name ?? (file.path.split(".").pop() ?? null);
      const bitDepth = vs?.pix_fmt?.includes("10") ? 10 : vs?.bits_per_raw_sample ? Number(vs.bits_per_raw_sample) : 8;
      const wish = choice.audioIndex === undefined && (choice.voice?.studio || choice.voice?.language) ? choice.voice! : null;
      const tracks = as.map((s) => ({ index: s.index, title: s.tags?.title ?? null, language: s.tags?.language ?? null, default: s === defaultAudio }));
      const wished = wish ? voiceTrack(tracks, wish, choice.profile?.studios) : null;
      // Nothing chosen (a copy already here, the next episode): the profile's order, as "Where to watch" offers audio.
      const preferred = choice.audioIndex === undefined && !wish && choice.profile ? profileTrack(tracks, choice.profile) : null;
      const pickedIndex = choice.audioIndex ?? wished ?? preferred ?? undefined;
      const picked = pickedIndex === undefined ? undefined : as.find((s) => s.index === pickedIndex);
      const chosenAudio = picked ?? defaultAudio;
      const file0 = { container, videoCodec: vs?.codec_name ?? null, audioCodec: chosenAudio?.codec_name ?? null, bitDepth, width: vs?.width ?? null, height: vs?.height ?? null, probed: Boolean(probe) };
      // A plain stream always plays the file's default track; any other one has to be rebuilt too.
      const otherTrack = Boolean(picked && picked !== defaultAudio);
      // A password-protected server's plain stream needs the service worker (it adds the password); without one the
      // rebuild still works: the engine sends the password itself.
      const noBridge = Boolean(authHeader && opts.connectionId) && typeof navigator !== "undefined" && !navigator.serviceWorker?.controller;
      // `rebuild`: the plain stream already failed to start in this browser (the player asks once).
      // Loaded only now: pages that show copies (home, titles) load this module but never prepare a playback.
      const { choosePlayback } = await import("./playback-choice");
      let how = await choosePlayback(caps, file0, { otherTrack: otherTrack || Boolean(choice.rebuild), noBridge });
      // An old AVI: played here only if this device decodes it fast enough, measured on the file's first seconds.
      if (how.path === "legacy") {
        const { probeLegacy } = await import("./legacy");
        const p = await optional(probeLegacy(raw), { ok: false as const, reason: "video unknown" });
        if (!p.ok) how = { path: "external", reason: `container avi, ${p.reason}` };
      }
      const legacy = how.path === "legacy";
      const remux = how.path === "remux" || legacy;
      const route = how.path === "remux" || how.path === "legacy" ? how.audio : undefined;
      const verdict = how.path === "external" ? { ok: false as const, reason: how.reason } : { ok: true as const };

      const listed = await subsAsked;
      const subtitles: SubtitleTrack[] = (Array.isArray(listed) ? listed : []).map((s, i) => ({
        id: String(s.index ?? s.id ?? i),
        lang: s.lang ?? "und",
        label: s.name ?? s.path?.split("/").pop() ?? `#${i + 1}`,
        url: authHeader && opts.connectionId ? `/__ts/${opts.connectionId}/subs/${hash}/${file.id}?track=${s.index ?? s.id ?? i}` : joinUrl(base, `/subs/${hash}/${file.id}?track=${s.index ?? s.id ?? i}`),
        kind: "subtitles" as const,
      }));
      // Subtitles the browser can't read itself: a Matroska file's text and picture tracks and an MP4's text
      // tracks, read by ranges around the playhead, and subtitle files next to it in the torrent.
      const subtitleCodecs = (probe?.streams ?? []).filter((s) => s.codec_type === "subtitle").map((s) => s.codec_name);
      const ownSubs =
        (/matroska|webm|mkv/i.test(container ?? "") && subtitleCodecs.some((c) => /^(subrip|srt|ass|ssa|webvtt|hdmv_pgs_subtitle|dvd_subtitle|text)$/.test(c))) ||
        (/mp4|mov/i.test(container ?? "") && subtitleCodecs.includes("mov_text"));
      const { externalSubtitles } = await import("./subs/text");
      const subFiles = externalSubtitles(t.file_stats ?? [], file, (t.file_stats ?? []).filter((f) => isVideoFile(f.path) && !isExtra(f.path)).length).map((x) => ({
        path: x.file.path,
        format: x.format,
        lang: x.lang,
        forced: x.forced,
        label: x.label,
        url: streamUrl(hash, x.file, false),
      }));
      const subtitleSources = ownSubs || subFiles.length ? { file: ownSubs ? raw : null, files: subFiles, headers: raw.headers, targetAddressSpace: raw.targetAddressSpace } : undefined;
      const playing = remux ? chosenAudio : defaultAudio;
      const audio: AudioOption[] = as.map((s, i) => ({
        index: s.index,
        label: s.tags?.title ?? s.tags?.language ?? `Audio ${i + 1}`,
        lang: s.tags?.language ?? null,
        codec: s.codec_name,
        isDefault: s === playing,
      }));
      const chosenCodec = chosenAudio?.codec_name ?? "";
      const prepared: PreparedPlayback = {
        url: streamUrl(hash, file, true),
        type: remux ? "remux" : "progressive",
        remuxAudio: remux ? chosenAudio?.index : undefined,
        remuxRoute: route,
        remuxEngine: legacy ? "legacy" : undefined,
        // The engine fetches the server itself, with the password: no service worker in between.
        remuxSource: remux ? raw : undefined,
        subtitleSources,
        mime: null,
        method: legacy ? "transcode" : remux ? "remux" : verdict.ok ? "direct" : "external",
        methodNote: legacy
          ? `video ${vs?.codec_name ?? "unknown"} → H.264 in the browser${route && chosenCodec ? `, audio ${chosenCodec} → ${route === "aac" ? "AAC" : "Opus"} in the browser` : ""}`
          : remux
          ? route && route !== "copy" && chosenCodec
            ? `audio ${chosenCodec} → ${route === "aac" ? "AAC" : "Opus"} in the browser`
            : "rebuilt in the browser"
          : verdict.ok
            ? null
            : verdict.reason,
        // Another track means rebuilding in the browser; the player asks for it (WatchView re-prepares).
        selectAudio: as.length > 1 && probe && canRemuxInBrowser(caps, { ...file0, audioCodec: null }).ok ? (i: number) => client.prepare(externalId, { audioIndex: i }) : undefined,
        subtitles,
        audio,
        voice: wish?.studio ? { studio: wish.studio, match: wished !== null && playing?.index === wished ? "playing" : "unknown" } : undefined,
        // Intro and credits from chapters named so, when the server's probe gives chapters.
        segments: chapterSegments(probe?.chapters),
        // What the probe read, for "Playback info".
        info: probe
          ? {
              container: container?.split(",")[0] ?? null,
              videoCodec: vs?.codec_name ?? null,
              audioCodec: (remux ? chosenAudio : defaultAudio)?.codec_name ?? null,
              width: vs?.width ?? null,
              height: vs?.height ?? null,
              bitrate: probe.format?.bit_rate ? Number(probe.format.bit_rate) : null,
            }
          : undefined,
        durationSec: probe?.format?.duration ? Number(probe.format.duration) : null,
        sizeBytes: file.length || null,
        fileRead: fresh && probe ? { hash: hash.toLowerCase(), file: file.id, probe, torrentTitle: t.title ?? "", torrentSize: t.torrent_size ?? null } : undefined,
        // Dolby Vision without an HDR10 base layer (profile 5) shows wrong colours where it isn't decoded.
        warning: vs?.side_data_list?.some((x) => /dovi|dolby vision/i.test(x.side_data_type ?? "") && x.dv_profile === 5) && !caps.dolbyVision ? "dv5" : undefined,
        externalUrl: externalUrl(hash, file),
        incompatibility: verdict.ok ? null : verdict.reason,
        stats: async () => {
          try {
            const s = await get<TsTorrent>(`/stream?link=${hash}&stat`, 8000);
            // A missing field stays unknown; it is not a measured zero.
            const n = (v: number | undefined) => (typeof v === "number" ? v : null);
            return { peers: n(s.active_peers), seeders: n(s.connected_seeders), speedBps: n(s.download_speed), preloadedBytes: n(s.preloaded_bytes) };
          } catch {
            return null;
          }
        },
      };
      return prepared;
    },
  };
  return client;
}
