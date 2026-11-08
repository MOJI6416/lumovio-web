"use client";

import type { ConnectionSummary, ReleaseQuality, TitleDetails } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { useReleaseText } from "@/components/sources/release-text";
import { type LookupResult, lookupKey, useReleasePrefs } from "@/hooks/useTorrentLookup";
import { namesNumbering, reportNumbering } from "@/lib/media/numbering-evidence";
import { ANY, type Edition, pickRelease } from "@/lib/media/release-pick";
import { isDubStudio, optionIsStudio, pictureVersions, type RankedRelease, rankReleases, torrentQuery, type VoiceOption, voiceKeys, voiceOptions, voiceWish } from "@/lib/media/releases";
import { lookupTracks } from "@/lib/media/release-tracks";
import { torrServerFor } from "@/lib/media/torrent-source";
import { keepThroughEmpty, type SearchAnswer, type TsSearchResult, trackersOf } from "@/lib/media/torrserver";

/*
 * The TorrServer search of the sources screen without its look (TS1–TS6, SRC-07…SRC-13): the server, the query and
 * its answer, the audio / picture / tracker filters and the order, the recommendation and what a pick carries. The
 * site's TorrentFinder and the TV's (tvui/sources) render it each their own way.
 */

export const PAGE = 30;
const SERVER_KEY = "lumovio.sources.server";

/**
 * The orders of the list, each one choice (SRC-08: one "quality" in the panel, not three): the recommendation under
 * the profile's quality mode, the best picture ("best" mode), the smaller file ("small" mode), seeders, date.
 */
export type Sort = "recommended" | "quality" | "size" | "seeders" | "date";
export const SORTS: Sort[] = ["recommended", "quality", "size", "seeders", "date"];
const MODE_OF: Partial<Record<Sort, ReleaseQuality>> = { quality: "best", size: "small" };
const SORT_OF: Record<ReleaseQuality, Sort> = { auto: "recommended", best: "quality", small: "size" };
const RES_DESC = [2160, 1080, 720, 480];
const SOURCE_DESC = ["remux", "bluray", "webdl", "webrip", "hdtv", "dvd"];
const last = (n: number) => (n < 0 ? 99 : n);
const EDITIONS: Edition[] = ["theatrical", "extended", "directors", "final", "unrated", "imax"];
/** The site's orders (its quality mode is the "Quality" pill's): as recommended, more seeders, newer first. */
export const SITE_SORTS: Sort[] = ["recommended", "seeders", "date"];

/** Picture (resolution, HDR, source, then the bigger file), smaller file, more seeders, newer. Unknown values go last, never as zero. */
const ORDER: Record<Exclude<Sort, "recommended">, (a: RankedRelease, b: RankedRelease) => number> = {
  quality: (a, b) =>
    last(RES_DESC.indexOf(a.info.resolution ?? 0)) - last(RES_DESC.indexOf(b.info.resolution ?? 0)) ||
    b.info.hdrFormats.length - a.info.hdrFormats.length ||
    last(SOURCE_DESC.indexOf(a.info.source ?? "")) - last(SOURCE_DESC.indexOf(b.info.source ?? "")) ||
    (b.result.size ?? 0) - (a.result.size ?? 0),
  size: (a, b) => (a.result.size ?? Number.MAX_SAFE_INTEGER) - (b.result.size ?? Number.MAX_SAFE_INTEGER),
  seeders: (a, b) => (b.result.seeders ?? -1) - (a.result.seeders ?? -1),
  date: (a, b) => (b.result.published ?? "").localeCompare(a.result.published ?? ""),
};

type Status = { kind: "idle" } | { kind: "searching" } | { kind: "cancelled" } | { kind: "done" } | { kind: "error"; error: unknown };
type Found = SearchAnswer & { query: string };

/** What the title page had picked when it opened this screen: an audio option, a picture version, a quality mode, a cut. */
export interface FinderStart {
  voice: string | null;
  picture: string | null;
  quality: ReleaseQuality | null;
  edition?: string | null;
}

/**
 * A release the person chose to watch. `voice`: the audio option it was picked for (`voiceKeys`), so the
 * player starts its track; `linked`: it is already on that TorrServer for this title, so nothing is added.
 */
export interface FinderPick {
  connectionId: string;
  result: TsSearchResult;
  voice: string | null;
  linked: boolean;
  /** The release in words ("1080p · WEB-DL · Russian · dubbed"), for the stages of starting it. */
  version: string;
  /** Releases of the same audio and picture to add instead if the server doesn't take this one (item 3). */
  fallbacks: TsSearchResult[];
}

/**
 * The server the search starts on: the current copy's; else the one whose answer for this title is already here (the
 * title page's "Where to watch" searched it), so the screen shows what the title page did; else the last one searched
 * here; else one that searches on its own and answered its last check (as `autoSearchSource`), else any that searches
 * on its own (SRC-11).
 */
function firstServer(connections: ConnectionSummary[], preferred: string | null | undefined, answered: (id: string) => boolean): string {
  let remembered: string | null = null;
  try {
    remembered = localStorage.getItem(SERVER_KEY);
  } catch {
    /* storage unavailable */
  }
  const reachable = (c: ConnectionSummary) => c.status !== "unreachable" && c.status !== "unauthorized";
  const pick =
    connections.find((c) => c.id === preferred) ??
    connections.find((c) => answered(c.id)) ??
    connections.find((c) => c.id === remembered) ??
    connections.find((c) => c.settings.autoSearch && reachable(c)) ??
    connections.find((c) => c.settings.autoSearch) ??
    connections[0];
  return pick?.id ?? "";
}

export interface FinderProps {
  details: TitleDetails;
  season: number | null;
  episode: number | null;
  /** The TorrServers the active profile may use. */
  connections: ConnectionSummary[];
  defaultConnectionId?: string | null;
  /** Hashes already linked to this title, per connection ("<connectionId>:<hash>"). */
  existing: Set<string>;
  /** The audio tracks the player read in a result's file, when it is a copy already on the server (`rankReleases`). */
  fileTracks?: (r: TsSearchResult) => readonly string[] | null;
  start?: FinderStart;
  /** Search right away when nothing was searched yet (the sources screen was asked for). */
  autoStart?: boolean | "now";
  /** Adding it and starting it are the screen's stages. `anchor`: the row's "Watch", for coming back to the same place. */
  onPick: (pick: FinderPick, anchor: Element | null) => void;
  /**
   * The site: whether this search is the screen's first way to watch (no copy above it, nothing playing) — its pick
   * then has the white "Watch". Left out: known from the title's copies for this episode.
   */
  lead?: boolean;
}

/**
 * `modeInSort` (the TV, as before): the order of the list carries the quality mode ("Best quality" ranks by the best
 * mode). The site keeps the mode in its "Quality" pill, as "Where to watch" does, and the order only orders the list.
 */
export function useTorrentFinder({ details: d, season, episode, connections, defaultConnectionId, existing, fileTracks, start, autoStart = false, onPick }: FinderProps, { modeInSort = true }: { modeInSort?: boolean } = {}) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const qc = useQueryClient();
  const { me } = useSession();
  const profileId = me?.activeProfile?.id ?? null;
  const defaultQuery = torrentQuery(d);
  const cachedFor = (id: string): Found | null => {
    const c = qc.getQueryData<LookupResult>(lookupKey(profileId, id, d.id));
    return c ? { ...c, query: defaultQuery } : null;
  };
  const [connId, setConnId] = useState(() => firstServer(connections, defaultConnectionId, (id) => cachedFor(id) !== null));
  const [query, setQuery] = useState(defaultQuery);
  const [editing, setEditing] = useState(false);
  const [found, setFound] = useState<Found | null>(() => cachedFor(connId));
  const [status, setStatus] = useState<Status>(() => (found ? { kind: "done" } : { kind: "idle" }));
  const base = useReleasePrefs();
  const [sort, setSort] = useState<Sort>(modeInSort && start?.quality ? SORT_OF[start.quality] : "recommended");
  // The site's quality mode for this viewing (its "Quality" pill); the profile's until one is chosen.
  const [ownMode, setMode] = useState<ReleaseQuality | null>(modeInSort ? null : (start?.quality ?? null));
  const mode = (modeInSort ? MODE_OF[sort] : undefined) ?? ownMode ?? base.quality;
  const prefs = useMemo(() => ({ ...base, quality: mode }), [base, mode]);
  const text = useReleaseText();
  const [tracker, setTracker] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(start?.voice ?? null);
  const [picture, setPicture] = useState<string | null>(start?.picture ?? null);
  const [shown, setShown] = useState(PAGE);
  // The site's cut (null: any) and the audio the title page sent, until the person chooses one here.
  const [edition, setEdition] = useState<string | null>(() => (start?.edition && EDITIONS.includes(start.edition as Edition) ? start.edition : null));
  const startVoice = useRef(modeInSort ? null : (start?.voice ?? null));
  // The release whose details are open (a dialog, a sheet on a phone; a card in the middle on a TV).
  const [detailed, setDetailed] = useState<TsSearchResult | null>(null);
  const run = useRef<AbortController | null>(null);
  const shownFor = useRef(connId);

  // Results belong to one server: switching it never shows the previous server's answer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on connection change only
  useEffect(() => {
    if (shownFor.current === connId) return;
    shownFor.current = connId;
    run.current?.abort();
    try {
      localStorage.setItem(SERVER_KEY, connId);
    } catch {
      /* storage unavailable */
    }
    const cached = cachedFor(connId);
    setFound(cached);
    setStatus(cached ? { kind: "done" } : { kind: "idle" });
    if (!cached && connections.find((c) => c.id === connId)?.settings.autoSearch) void search();
  }, [connId]);
  // One first search when the screen was asked for and nothing is known yet — only on a server that
  // may search by itself (its "search automatically" setting), or when the person asked for one ("Find a source", T14:
  // "now"); elsewhere the search waits for a tap.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on open only
  useEffect(() => {
    if (autoStart && !found && (autoStart === "now" || connections.find((c) => c.id === connId)?.settings.autoSearch)) void search();
    return () => run.current?.abort();
  }, []);

  /** A search for `text` (the query being set at the same time), else for the query as it is. */
  const search = async (text?: string) => {
    run.current?.abort();
    const ctrl = new AbortController();
    run.current = ctrl;
    const q = (text ?? query).trim() || defaultQuery;
    setStatus({ kind: "searching" });
    setTracker(null);
    setShown(PAGE);
    try {
      const r = await (await torrServerFor(connId)).search(q, ctrl.signal);
      if (run.current !== ctrl) return;
      if (d.kind === "tv") reportNumbering(d.id, "names", namesNumbering(r.results, d));
      // A refresh of the same search that comes back empty keeps the results shown (failing indexers
      // answer so too), with their age; another query's empty answer is just that.
      const next = keepThroughEmpty(found?.query === q ? found : null, { ...r, at: Date.now() });
      // The title's own query is the title page's search too: it shows this answer from now on.
      if (q === defaultQuery) qc.setQueryData<LookupResult>(lookupKey(profileId, connId, d.id), next);
      setFound({ ...next, query: q });
      setStatus({ kind: "done" });
      setEditing(false);
    } catch (e) {
      if (run.current !== ctrl) return;
      // A failed refresh keeps the answer already shown (said with its age), it doesn't wipe it.
      setStatus(ctrl.signal.aborted ? { kind: "cancelled" } : { kind: "error", error: e });
    }
  };

  const cancel = () => {
    run.current?.abort();
    setStatus({ kind: "cancelled" });
  };

  // Releases of this title first, best for the profile's languages, studios, mode and this device; the
  // rest follow by seeders (the indexer's numbers; unknown ones last), so a custom query still shows everything.
  // The shared cache of releases' file tracks (7.15 «Чтение дорожек заранее»), under a copy's own read.
  const shared = useQuery({
    queryKey: ["releaseTracks", ...lookupKey(profileId, connId, d.id), found?.at ?? 0, found?.query ?? ""],
    enabled: Boolean(profileId && found?.results.length),
    staleTime: 30 * 60_000,
    queryFn: () => lookupTracks(found?.results ?? []),
  }).data;
  const fileOf = useMemo(() => (shared ? (r: TsSearchResult) => fileTracks?.(r) ?? shared.get(r.title) : (fileTracks ?? null)), [shared, fileTracks]);
  const view = useMemo(() => {
    if (!found) return null;
    // An episode is wanted: a release whose name holds other seasons (or other episodes of the season) only sinks.
    // A result that is a copy already on the server: its studios as its file's tracks name them ("6x MVO").
    const ranked = rankReleases(found.results, d, prefs, d.kind === "tv" ? season : null, d.kind === "tv" ? episode : null, fileOf);
    const mine = new Set(ranked.map((x) => x.result.link));
    const rest = found.results.filter((x) => !mine.has(x.link)).sort((a, b) => (b.seeders ?? -1) - (a.seeders ?? -1));
    return { ranked, byLink: new Map(ranked.map((x) => [x.result.link, x])), rest };
  }, [found, d, prefs, season, episode, fileOf]);
  // Audio options grouped by language: the profile's languages first, each studio under its own language (SRC-04).
  const options = useMemo(() => {
    // Releases of other seasons only aren't offered as an audio or a picture to pick (they stay in the list, last).
    const all = voiceOptions((view?.ranked ?? []).filter((x) => x.holds !== false), 60);
    const rank = (o: VoiceOption) => {
      const i = o.language ? base.languages.indexOf(o.language) : -1;
      return i >= 0 ? i : o.language ? base.languages.length : base.languages.length + 1;
    };
    // In a language, the profile's studios first, in their order ("1 — LostFilm, 2 — HDRezka"), as "Where to watch" offers them.
    const studio = (o: VoiceOption) => {
      const i = base.studios.findIndex((s) => optionIsStudio(o, s));
      return i >= 0 ? i : base.studios.length;
    };
    return all
      .map((o, i) => ({ o, i }))
      .sort((a, b) => rank(a.o) - rank(b.o) || (a.o.language ?? "").localeCompare(b.o.language ?? "") || studio(a.o) - studio(b.o) || a.i - b.i)
      .map((x) => x.o);
  }, [view, base.languages, base.studios]);
  const inVoice = (x: RankedRelease) => voice === null || voiceKeys(x).includes(voice);
  const versions = useMemo(
    () => pictureVersions((view?.ranked ?? []).filter((x) => !x.dead && x.holds !== false && (voice === null || voiceKeys(x).includes(voice)))),
    [view, voice],
  );
  const trackers = useMemo(() => {
    const m = new Map<string, number>();
    // A torrent several indexers returned counts for each of them.
    for (const r of found?.results ?? []) for (const name of trackersOf(r)) m.set(name ?? "?", (m.get(name ?? "?") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [found]);
  const filtered = voice !== null || picture !== null || tracker !== null;
  // Audio and picture filters keep releases of this title only; other results show without them.
  const visible = view
    ? [
        ...view.ranked
          .filter((x) => inVoice(x) && (picture === null || x.picture === picture))
          // Whatever the order, releases of other seasons only stay below the wanted season's (the rank puts them there).
          .sort(sort === "recommended" ? () => 0 : (a, b) => Number(a.holds === false) - Number(b.holds === false) || ORDER[sort](a, b))
          .map((x) => x.result),
        ...(voice === null && picture === null ? view.rest : []),
      ].filter((r) => tracker === null || trackersOf(r).some((name) => (name ?? "?") === tracker))
    : [];
  // The recommendation follows the rank, whatever order the list is sorted in.
  const shownLinks = new Set(visible.map((r) => r.link));
  // The release "Where to watch" and the hero start (`pickRelease`: the profile's audio, the default cut, the mode's
  // picture), when the list shows it; else the first one shown that could be.
  const picked = view ? pickRelease(view.ranked, prefs).chosen : undefined;
  const recommended = picked && shownLinks.has(picked.result.link) ? picked : view?.ranked.find((x) => shownLinks.has(x.result.link) && !x.dead && !x.info.cam && x.holds !== false);
  const server = connections.find((c) => c.id === connId)?.name ?? "TorrServer";
  /** An audio, picture or tracker filter: the list starts again from its first part. */
  const filter = (kind: "voice" | "picture" | "tracker", value: string | null) => {
    if (kind === "voice") setVoice(value);
    else if (kind === "picture") setPicture(value);
    else setTracker(value);
    setShown(PAGE);
  };
  const reset = () => {
    setVoice(null);
    setPicture(null);
    setTracker(null);
    setEdition(null);
    startVoice.current = null;
    setShown(PAGE);
  };

  // The site (design-system 7.15 «Экран источников»): the pills of "Where to watch" narrowing the list, its card the
  // list's first. The title page always sends its audio; when that is just its default, nothing was chosen, and the
  // screen of "All releases" lists every audio (the card is the same release either way).
  const titleDefault = useMemo(() => (view && !modeInSort ? (pickRelease(view.ranked, base).option?.key ?? null) : null), [view, base, modeInSort]);
  const siteVoice = voice !== null && voice === startVoice.current && voice === titleDefault ? null : voice;
  const choice = useMemo(() => (modeInSort || !view ? null : pickRelease(view.ranked, base, { voice: siteVoice ?? ANY, edition: (edition as Edition | null) ?? ANY, picture }, 40)), [modeInSort, view, base, siteVoice, edition, picture]);
  /** The site's choices, each narrowing the next and starting the list again (the ones after it go back to "any"). */
  const choose = (next: { voice?: string | null; edition?: string | null; picture?: string | null; mode?: ReleaseQuality }) => {
    // The title page's audio is read once: whatever is chosen here keeps it as it is shown now (a new mode reranks the
    // releases, and the title's own pick may then be another audio — "Any" must not turn into it).
    if (startVoice.current !== null) {
      if (siteVoice === null) setVoice(null);
      startVoice.current = null;
    }
    if ("voice" in next) {
      startVoice.current = null;
      setVoice(next.voice ?? null);
      setEdition(null);
      setPicture(null);
    }
    if ("edition" in next) {
      setEdition(next.edition ?? null);
      setPicture(null);
    }
    if ("picture" in next) setPicture(next.picture ?? null);
    if (next.mode) {
      setMode(next.mode);
      setPicture(null);
    }
    setShown(PAGE);
  };
  // The list under the card: the chosen audio's and cut's other releases (one picture version when it was chosen by
  // hand), in the chosen order; then, folded, what can't be picked — other titles of the query, cinema recordings,
  // releases without seeders or of other seasons.
  const listed = useMemo(() => {
    if (!choice || !view) return { rows: [] as RankedRelease[], rest: [] as TsSearchResult[] };
    const rows = (picture ? choice.pool.filter((x) => x.picture === picture) : choice.pool).filter((x) => x !== choice.chosen);
    if (sort !== "recommended") rows.sort(ORDER[sort]);
    const eligible = new Set(view.ranked.filter((x) => x.holds !== false && !x.info.cam && !x.dead).map((x) => x.result.link));
    const rest = [...view.ranked.filter((x) => !eligible.has(x.result.link)).map((x) => x.result), ...view.rest];
    return { rows, rest };
  }, [choice, view, picture, sort]);

  // The dubbing a release is picked for: the audio filter's, else the profile's studio it credits, else its only
  // studio, else its track in the profile's language. Otherwise it plays the file's default track.
  const voiceFor = (r: TsSearchResult): string | null => {
    const x = view?.byLink.get(r.link);
    if (!x) return null;
    const keys = voiceKeys(x);
    if (voice !== null && keys.includes(voice)) return voice;
    if (x.studio && isDubStudio(x.studio)) return keys.find((k) => k.endsWith("|dub")) ?? null;
    if (x.studio) return keys.find((k) => k.endsWith(`|${x.studio}`)) ?? `${x.language ?? ""}|${x.studio}`;
    if (x.info.studios.length === 1) return keys.find((k) => k.endsWith(`|${x.info.studios[0]}`)) ?? null;
    return x.language ? (keys.find((k) => k.startsWith(`${x.language}|`)) ?? null) : null;
  };
  // What a release plays when picked here, in words: the studio `voiceFor` starts ("Russian · multi-voice (LostFilm)"),
  // not every track its name lists in its own order (HDrezka Studio first on RuTracker).
  const heard = (x: RankedRelease) => text.audio(x, voiceWish(voiceFor(x.result))?.studio);
  const isLinked = (r: TsSearchResult) => r.hash !== null && existing.has(`${connId}:${r.hash}`);
  const versionOf = (r: TsSearchResult) => {
    const x = view?.byLink.get(r.link);
    return x ? [text.picture(x.info), heard(x)].filter(Boolean).join(" · ") : r.title;
  };
  // Two releases a failed add falls back on (item 3, S3): the same audio and picture, alive — another tracker's first
  // (a tracker that refused one release usually refuses its others), then the list's order.
  const fallbacks = (r: TsSearchResult): TsSearchResult[] => {
    const x = view?.byLink.get(r.link);
    if (!x || !view) return [];
    const keys = voiceKeys(x);
    return view.ranked
      .filter((y) => y !== x && !y.dead && !y.info.cam && y.holds !== false && y.picture === x.picture && voiceKeys(y).some((k) => keys.includes(k)))
      .sort((a, b) => Number(a.result.tracker === r.tracker) - Number(b.result.tracker === r.tracker))
      .slice(0, 2)
      .map((y) => y.result);
  };
  const pick = (r: TsSearchResult, anchor: Element | null) =>
    onPick({ connectionId: connId, result: r, voice: voiceFor(r), linked: isLinked(r), version: versionOf(r), fallbacks: isLinked(r) ? [] : fallbacks(r) }, anchor);

  const minutes = found ? Math.max(0, Math.round((Date.now() - found.at) / 60_000)) : 0;
  // "Russian · HDrezka Studio · 32": the language first, so one studio in two languages is two clear options (SRC-04).
  const optionLabel = (o: VoiceOption) => {
    const count = o.versions.reduce((n, v) => n + v.count, 0);
    const name = o.studio ?? (o.voice ? tt(`voice_${o.voice}`) : null);
    return [o.language ? text.cap(text.language(o.language)) : tt("tsLanguageUnknown"), name, count].filter((x) => x !== null).join(" · ");
  };
  const where = d.kind === "tv" && season !== null && episode !== null ? t("findSourceEpisode", { season, episode }) : t("findSourceMovie");


  return {
    connId,
    setConnId,
    server,
    defaultQuery,
    query,
    setQuery,
    editing,
    setEditing,
    found,
    status,
    search,
    cancel,
    sort,
    setSort,
    voice,
    picture,
    tracker,
    filter,
    filtered,
    reset,
    shown,
    setShown,
    detailed,
    setDetailed,
    view,
    options,
    versions,
    trackers,
    visible,
    recommended,
    isLinked,
    versionOf,
    heard,
    pick,
    minutes,
    optionLabel,
    where,
    // The site's (null on the TV).
    mode,
    edition,
    choice,
    choose,
    listed,
  };
}
