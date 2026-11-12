"use client";

import type { ConnectionSummary, ReleaseQuality, TitleDetails } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSession } from "@/components/providers/Providers";
import { useReleaseText } from "@/components/sources/release-text";
import { type LookupResult, lookupKey, useReleasePrefs } from "@/hooks/useTorrentLookup";
import { namesNumbering, reportNumbering } from "@/lib/media/numbering-evidence";
import { ANY, type Edition, pickRelease } from "@/lib/media/release-pick";
import { type RankedRelease, rankReleases, torrentQuery, type VoiceOption, voiceKeys, voiceWish, wishNameTrack } from "@/lib/media/releases";
import { lineSpeed, subscribeLine } from "@/lib/media/line-speed";
import { torrServerFor } from "@/lib/media/torrent-source";
import { keepThroughEmpty, type SearchAnswer, type TsSearchResult } from "@/lib/media/torrserver";

/*
 * The TorrServer search of the sources screen without its look: the server, the query and
 * its answer, the choice of audio, cut and quality as "Where to watch" makes it, the order, and what a pick carries.
 * The site's TorrentFinder and the TV's (tvui/sources) render it each their own way.
 */

export const PAGE = 30;
const SERVER_KEY = "lumovio.sources.server";

/** The orders of the list (the quality mode is the "Quality" choice's): as recommended, more seeders, newer first. */
export type Sort = "recommended" | "seeders" | "date";
export const SORTS: Sort[] = ["recommended", "seeders", "date"];
const EDITIONS: Edition[] = ["theatrical", "extended", "directors", "final", "unrated", "imax"];

/** More seeders, newer. Unknown values go last, never as zero. */
const ORDER: Record<Exclude<Sort, "recommended">, (a: RankedRelease, b: RankedRelease) => number> = {
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
}

/**
 * The server the search starts on: the current copy's; else the one whose answer for this title is already here (the
 * title page's "Where to watch" searched it), so the screen shows what the title page did; else the last one searched
 * here; else one that searches on its own and answered its last check (as `autoSearchSource`), else any that searches
 * on its own.
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
  autoStart?: boolean;
  /** Adding it and starting it are the screen's stages. `anchor`: the row's "Watch", for coming back to the same place. */
  onPick: (pick: FinderPick, anchor: Element | null) => void;
  /**
   * The site: whether this search is the screen's first way to watch (no copy above it, nothing playing) — its pick
   * then has the white "Watch". Left out: known from the title's copies for this episode.
   */
  lead?: boolean;
}

/** The quality mode is a choice of its own ("Quality"), as on "Where to watch"; the order only orders the list. */
export function useTorrentFinder({ details: d, season, episode, connections, defaultConnectionId, existing, fileTracks, start, autoStart = false, onPick }: FinderProps) {
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
  const [sort, setSort] = useState<Sort>("recommended");
  // The quality mode for this viewing (the "Quality" choice); the profile's until one is chosen.
  const [ownMode, setMode] = useState<ReleaseQuality | null>(start?.quality ?? null);
  const mode = ownMode ?? base.quality;
  // What the chosen server's line gave this device's playbacks: "Auto" ranks by it (lib/media/line-speed).
  const lineBps = useSyncExternalStore(subscribeLine, () => lineSpeed(connId), () => null);
  const prefs = useMemo(() => ({ ...base, quality: mode, lineBps }), [base, mode, lineBps]);
  const text = useReleaseText();
  const [voice, setVoice] = useState<string | null>(start?.voice ?? null);
  const [picture, setPicture] = useState<string | null>(start?.picture ?? null);
  const [shown, setShown] = useState(PAGE);
  // The cut (null: any) and the audio the title page sent, until the person chooses one here.
  const [edition, setEdition] = useState<string | null>(() => (start?.edition && EDITIONS.includes(start.edition as Edition) ? start.edition : null));
  const startVoice = useRef(start?.voice ?? null);
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
  // may search by itself (its "search automatically" setting); elsewhere the search waits for a tap.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on open only
  useEffect(() => {
    if (autoStart && !found && connections.find((c) => c.id === connId)?.settings.autoSearch) void search();
    return () => run.current?.abort();
  }, []);

  /** A search for `text` (the query being set at the same time), else for the query as it is. */
  const search = async (text?: string) => {
    run.current?.abort();
    const ctrl = new AbortController();
    run.current = ctrl;
    const q = (text ?? query).trim() || defaultQuery;
    setStatus({ kind: "searching" });
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
  const view = useMemo(() => {
    if (!found) return null;
    // An episode is wanted: a release whose name holds other seasons (or other episodes of the season) only sinks.
    // A result that is a copy already on the server: its studios as its file's tracks name them ("6x MVO").
    const ranked = rankReleases(found.results, d, prefs, d.kind === "tv" ? season : null, d.kind === "tv" ? episode : null, fileTracks ?? null);
    const mine = new Set(ranked.map((x) => x.result.link));
    const rest = found.results.filter((x) => !mine.has(x.link)).sort((a, b) => (b.seeders ?? -1) - (a.seeders ?? -1));
    return { ranked, byLink: new Map(ranked.map((x) => [x.result.link, x])), rest };
  }, [found, d, prefs, season, episode, fileTracks]);

  const server = connections.find((c) => c.id === connId)?.name ?? "TorrServer";
  /** Any audio, cut and picture again (the TV's "Reset"). */
  const reset = () => {
    setVoice(null);
    setPicture(null);
    setEdition(null);
    startVoice.current = null;
    setShown(PAGE);
  };

  // The choices of "Where to watch" narrowing the list, its pick the
  // list's first. The title page always sends its audio; when that is just its default, nothing was chosen, and the
  // screen of "All releases" lists every audio (the card is the same release either way).
  const titleDefault = useMemo(() => (view ? (pickRelease(view.ranked, base).option?.key ?? null) : null), [view, base]);
  const siteVoice = voice !== null && voice === startVoice.current && voice === titleDefault ? null : voice;
  const choice = useMemo(() => (!view ? null : pickRelease(view.ranked, base, { voice: siteVoice ?? ANY, edition: (edition as Edition | null) ?? ANY, picture }, 40)), [view, base, siteVoice, edition, picture]);
  /** The choices, each narrowing the next and starting the list again (the ones after it go back to "any"). */
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
    if (x.studio) return keys.find((k) => k.endsWith(`|${x.studio}`)) ?? `${x.language ?? ""}|${x.studio}`;
    if (x.info.studios.length === 1) return keys.find((k) => k.endsWith(`|${x.info.studios[0]}`)) ?? null;
    return x.language ? (keys.find((k) => k.startsWith(`${x.language}|`)) ?? null) : null;
  };
  // What a release plays when picked here, in words: the studio `voiceFor` starts ("Russian · multi-voice (LostFilm)"),
  // not every track its name lists in its own order (HDrezka Studio first on RuTracker).
  const heard = (x: RankedRelease) => {
    const wish = voiceWish(voiceFor(x.result));
    return text.audio(x, wish?.studio ?? wishNameTrack(x.info, wish, base.studios));
  };
  const isLinked = (r: TsSearchResult) => r.hash !== null && existing.has(`${connId}:${r.hash}`);
  const versionOf = (r: TsSearchResult) => {
    const x = view?.byLink.get(r.link);
    return x ? [text.picture(x.info), heard(x)].filter(Boolean).join(" · ") : r.title;
  };
  const pick = (r: TsSearchResult, anchor: Element | null) => onPick({ connectionId: connId, result: r, voice: voiceFor(r), linked: isLinked(r), version: versionOf(r) }, anchor);

  const minutes = found ? Math.max(0, Math.round((Date.now() - found.at) / 60_000)) : 0;
  // "Russian · HDrezka Studio · 32": the language first, so one studio in two languages is two clear options.
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
    reset,
    shown,
    setShown,
    detailed,
    setDetailed,
    view,
    isLinked,
    versionOf,
    heard,
    pick,
    minutes,
    optionLabel,
    where,
    mode,
    edition,
    choice,
    choose,
    listed,
  };
}
