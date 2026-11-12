"use client";

import type { Availability, CastFailure, ConnectionSummary, PlaybackProgress, ReleaseQuality, SeasonDetails, TitleDetails, TorrentBindResult } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, FileVideo, Link2Off, Play, RefreshCw, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { CopyChoice } from "@/components/sources/CopyChoice";
import { CopyDetails } from "@/components/sources/CopyDetails";
import { useCopyText } from "@/components/sources/copy-text";
import { QualityLine } from "@/components/sources/QualityBadges";
import { EpisodePick } from "@/components/sources/EpisodePick";
import { useMediaErrorText } from "@/components/sources/media-error";
import { formatSize } from "@/components/sources/release-text";
import { SourceRow, SourceSection } from "@/components/sources/SourceRow";
import { CopyActions, CopyRemovalDialog, FIND_SOURCE_ID, type RemovalTarget } from "@/components/title/CopyActions";
import { useCastReport } from "@/components/tv/cast-report";
import { useTvNavOptional } from "@/components/tvui/nav/context";
import type { TvAction, TvSourcesProps } from "@/components/tvui/sources/TvSources";
import { AccentBadge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import type { Step } from "@/components/ui/Progress";
import { PortalContainerContext } from "@/components/ui/portal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { useTitleAvailability } from "@/hooks/useAvailability";
import { useGoUp } from "@/hooks/useGoUp";
import { useLibraryState } from "@/hooks/useLibraryState";
import { useSpoilerPrefs } from "@/hooks/useSpoilers";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiRequestError, api } from "@/lib/api";
import { reportPlayback } from "@/lib/last-playback";
import { trackOutcome } from "@/lib/discovery-metrics";
import { tmdbImage } from "@/lib/images";
import { detectCapabilities } from "@/lib/media/capabilities";
import { clientFor } from "@/lib/media/clients";
import { MediaNetError } from "@/lib/media/net";
import { filesNumbering, reportNumbering } from "@/lib/media/numbering-evidence";
import { type Prep, type PrepStage, stageState, stagesFor } from "@/lib/media/prepare-stages";
import { voiceWish } from "@/lib/media/releases";
import { holdsByName, holdsSeason, packOf } from "@/lib/media/packs";
import { copyAudio } from "@/lib/media/copy-audio";
import { orderedSources, sourceRank } from "@/lib/media/source-order";
import { forgetTorrents, invalidateAvailability, torrentPresence } from "@/lib/media/torrent-manage";
import { addTorrentSource, takeBack } from "@/lib/media/torrent-source";
import { type EpisodeFile, episodeFiles, isVideoFile, matchEpisode, pickMovieFile, TorrentFileMissing, type TsFile, type torrServerClient } from "@/lib/media/torrserver";
import type { PreparedPlayback } from "@/lib/media/types";
import { background, optional } from "@/lib/optional";
import { titleHref } from "@/lib/slug";
import { episodesOpen } from "@/lib/spoilers";
import { useAction } from "@/lib/use-action";
import { randomId } from "@/lib/random-id";
import { ExternalPlayerPanel } from "./ExternalPlayerPanel";
import { launchSince, startLaunch, useLaunch } from "./launch";
import { LumovioPlayer } from "./LumovioPlayer";
import type { FinderPick, FinderProps } from "./finder";
import { TorrentFinder } from "./TorrentFinder";

// The TV's composition of the sources screen (tvui/sources), loaded only in the TV shell.
const TvSources = dynamic<TvSourcesProps>(() => import("@/components/tvui/sources/TvSources").then((m) => m.TvSources), { ssr: false });
// "Watch on TV" in the player's corner (design-system 8.18): only on the site, after the picture is there.
const CastButton = dynamic(() => import("@/components/tv/CastButton").then((m) => m.CastButton), { ssr: false });
import { useWhy } from "./use-why";

interface Candidate {
  key: string;
  provider: Availability["kind"];
  /** The server's name. */
  label: string;
  server: Availability;
}

/** One torrent's files, offered when the film's or the episode's file is not certain. */
interface TorrentFiles {
  candidate: Candidate;
  hash: string;
  title: string;
  files: (TsFile | EpisodeFile)[];
  /** "unlinked": the file that matches was unlinked from this episode by the person, so it is asked about. */
  reason: "ambiguous" | "none" | "unlinked";
}

/**
 * Starting a source goes through its real stages (`prepare-stages.ts`); a failure keeps the stage it happened at.
 * `label`: what is started — its version and server (PLR-05). `fromScreen`: started from the sources screen, whose
 * search, filters and scroll stay as they were. An error's `retry` is null when repeating can't help (a torrent gone
 * from its server, a refused sign-in, SRC-03); `gone`: the torrent the server no longer has.
 */
type Phase =
  | { kind: "loading" }
  | { kind: "choose" }
  | { kind: "preparing"; candidate: Candidate | null; label: string; prep: Prep; fromScreen: boolean }
  | { kind: "pickFile"; torrents: TorrentFiles[]; added: string | null }
  | { kind: "playing" }
  | { kind: "external"; candidate: Candidate; prepared: PreparedPlayback; reason: string | null }
  | {
      kind: "error";
      candidate: Candidate | null;
      label: string;
      message: string;
      prep: Prep;
      retry: (() => void) | null;
      prepared?: PreparedPlayback;
      gone?: { connectionId: string; hash: string };
      auth?: boolean;
      /** Started from the sources screen: the failure is shown there; otherwise on the player's stage. */
      fromScreen?: boolean;
      /** What it was, for a phone that sent this viewing to the TV ("Watch on TV", design-system 8.18). */
      cause?: CastFailure;
    };

const KIND_LABEL = { jellyfin: "Jellyfin", plex: "Plex", torrserver: "TorrServer" } as const;

/** A rebuild engine's failure that is the stream breaking off, not the file: the network, a fetch cut, a timeout. */
const BROKE_OFF = /fetch|network|load failed|timed? ?out|connection|reset|aborted|ERR_/i;
/** How long each try to open a broken-off stream again waits: at once, then longer — then the error is said (`onFatal`). */
const REOPEN_AFTER = [0, 3_000, 10_000, 30_000, 60_000];
/** A failure this screen has already put into words (translated), shown as it is. */
class ShownError extends Error {}
const hashOf = (externalId: string) => externalId.split(":")[0]!;
// The quality modes a title page can hand over in `?quality=` (contracts ReleaseQuality; the type checks the keys).
// Not ReleaseQuality.safeParse: the zod value would load zod with the player (≈ 30 KB gzip).
const QUALITY_MODES: Record<ReleaseQuality, true> = { auto: true, best: true, small: true };
/** A torrent source pointing at one file (bound to this film or episode), as opposed to a whole torrent. */
const isBound = (c: Candidate) => c.provider === "torrserver" && c.server.externalId.includes(":");
const fileName = (f: TsFile) => f.path.split("/").pop() ?? f.path;

function toCandidate(s: Availability): Candidate {
  return { key: `${s.connectionId}:${s.externalId}`, provider: s.kind, label: s.connectionName, server: s };
}

/** The same copy: one key, or one torrent on one server (a torrent and the file of it bound here). */
const sameCopy = (a: Candidate | null | undefined, b: Candidate) =>
  Boolean(a) &&
  (a!.key === b.key ||
    (a!.provider === "torrserver" && b.provider === "torrserver" && a!.server.connectionId === b.server.connectionId && hashOf(a!.server.externalId).toLowerCase() === hashOf(b.server.externalId).toLowerCase()));

/** Another episode is another playback: fresh state, its own file, its own progress session. */
export function WatchView({ details }: { details: TitleDetails }) {
  const params = useSearchParams();
  // A viewing sent from a phone ("Watch on TV") is a new one too, even of the same episode.
  return <WatchSession key={`${params.get("s") ?? ""}:${params.get("e") ?? ""}:${params.get("cast") ?? ""}`} details={details} />;
}

/**
 * The player and the sources screen of one viewing (design-system 9 Immersive, 11.1; S25, S26; C15–C20). The screen:
 * "←" and the title (SRC-13), the profile's copies as SourceRows, the TorrServer search (SRC-07…SRC-12), the stages of
 * preparing with "Cancel" (SRC-18), a failure with "Retry" and "Another source" back at the same row (SRC-19). The
 * player opens it over itself without stopping (PLR-03): kept paused out of sight, it goes on from where it was.
 */
function WatchSession({ details: d }: { details: TitleDetails }) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const tc = useTranslations("common");
  const mediaError = useMediaErrorText();
  const copyText = useCopyText();
  const why = useWhy();
  const params = useSearchParams();
  const router = useRouter();
  const goUp = useGoUp();
  const locale = useLocale();
  const qc = useQueryClient();
  const tvNav = useTvNavOptional();
  // On a TV every control is the remote's 64 px target (5.6): ui's primitives take the large size there themselves.
  const { me } = useSession();
  const signedIn = Boolean(me?.activeProfile);
  const isKids = Boolean(me?.activeProfile?.isKids);
  // Copies in the profile's audio language start first (lib/media/source-order).
  const audioLangs = me?.activeProfile?.audioLanguages;
  const voiceStudios = me?.activeProfile?.voiceStudios;
  const season = d.kind === "tv" ? Number(params.get("s") ?? d.seasons.find((s) => s.seasonNumber > 0)?.seasonNumber ?? 1) : null;
  const episode = d.kind === "tv" ? Number(params.get("e") ?? 1) : null;
  const wanted = params.get("source");
  // "?pick=1": open the sources screen instead of starting playback (from the title page or the player).
  const picking = params.get("pick") === "1";
  // Sent from a phone ("Watch on TV", design-system 8.18): which sending it is, where the phone was ("?t="), its audio
  // track ("?audio="); the copy it sent ("?source=") starts or nothing does — never another one in its place.
  const castId = params.get("cast");
  const castStart = useRef(Number(params.get("t")) > 5 ? Number(params.get("t")) : null);
  const castAudio = useRef(params.get("audio") !== null && Number.isInteger(Number(params.get("audio"))) ? Number(params.get("audio")) : undefined);
  const [castMiss, setCastMiss] = useState<CastFailure | null>(null);
  // The audio track chosen in this viewing (the phone sends it to a TV with the viewing).
  const chosenAudio = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  // The player of this viewing: shown while playing, kept paused while the screen is shown over it.
  const [active, setActive] = useState<{ candidate: Candidate; prepared: PreparedPlayback } | null>(null);
  const [current, setCurrent] = useState<Candidate | null>(null);
  const [removal, setRemoval] = useState<RemovalTarget | null>(null);
  const [details, setDetails] = useState<Availability | null>(null);
  const [marked, setMarked] = useState<"pending" | "done" | "failed" | null>(null);
  // The player whose first frame has come (or a press it waits for), and what its torrent's server said before: the launch's.
  const [startedFor, setStartedFor] = useState<PreparedPlayback | null>(null);
  const [launchDetail, setLaunchDetail] = useState<string | null>(null);
  const failed = useRef(new Set<string>());
  // Copies whose plain stream failed to start here and were tried once more rebuilt in the browser.
  const rebuilt = useRef(new Set<string>());
  // When each source was opened again after its stream broke off (`onFatal`).
  const reopened = useRef(new Map<string, number[]>());
  // A try to open it again that waits (`onFatal`): cancelled by leaving the page or by another start.
  const pendingReopen = useRef<(() => void) | null>(null);
  useEffect(() => () => pendingReopen.current?.(), []);
  // A torrent this launch brought to the server — the title page's add (`?brought=1`) or the sources screen's — until its
  // first frame: one that never got there is taken back when the person leaves, cancels or goes to another source.
  // Never one that was on the server before.
  const brought = useRef<{ connectionId: string; hash: string } | null>(null);
  const takeBackBrought = useCallback((keep?: string) => {
    const b = brought.current;
    if (!b || keep === `${b.connectionId}:${b.hash}`) return;
    brought.current = null;
    // Once the player has let it go: a request for it by hash after the removal would add it back, nameless.
    window.setTimeout(() => background(takeBack(b.connectionId, b.hash).then(() => invalidateAvailability(qc))), 1500);
  }, [qc]);
  useEffect(() => () => takeBackBrought(), [takeBackBrought]);
  const sessionId = useRef(randomId());
  const seq = useRef(0);
  // A preparation that is cancelled or replaced by another stops at its next step: only the latest one counts.
  const attempt = useRef(0);
  // The preparation's requests (the server's probe, its subtitles, the torrent's start): stopped on the server when it is
  // cancelled, replaced or the page left — not only its next step.
  const prepAbort = useRef<AbortController | null>(null);
  useEffect(() => () => prepAbort.current?.abort(), []);
  // The copy being prepared, by key: a second press on its "Watch" while it is prepared starts nothing again.
  const preparingKey = useRef<string | null>(null);
  // Where to continue after switching source within this session (same title, same episode, same position).
  const resumeOverride = useRef<number | null>(null);
  // The dubbing chosen with a TorrServer release ("?voice=ru|HDrezka Studio"): its track plays once the file is read.
  const wishedVoice = useRef(voiceWish(params.get("voice")));
  // With no dubbing chosen, a TorrServer file plays the track of the profile's languages and studios, in their order.
  const heard = useRef<{ languages: string[]; studios: string[] } | null>(null);
  heard.current = me?.activeProfile ? { languages: me.activeProfile.audioLanguages, studios: me.activeProfile.voiceStudios } : null;
  // The source that last played in this session (with its dubbing): a failed replacement can go back to it.
  const lastGood = useRef<{ candidate: Candidate; voice: string | null } | null>(null);
  // The stages of the source playing now, for a failure in the player itself.
  const lastPrep = useRef<{ label: string; prep: Prep } | null>(null);
  // When the launch of the source playing now began (the press): its first play reports the start and how long it took.
  const startClock = useRef<number | null>(null);
  // Where the sources screen was when a preparation started from it: the control picked and where it stood.
  const savedPlace = useRef<{ el: Element | null; top: number } | null>(null);
  /** Keeps the screen's place — read before the screen is hidden, as the shorter page would clamp it. */
  const keepPlace = useCallback((el: Element | null) => {
    savedPlace.current ??= { el, top: el?.getBoundingClientRect().top ?? 0 };
  }, []);
  const preparing = useRef(false);
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);

  const avail = useTitleAvailability(d.id);
  const conns = useQuery({
    queryKey: ["connections"],
    queryFn: () => api<{ connections: ConnectionSummary[] }>("/api/connections"),
    enabled: signedIn && !isKids,
  });
  const progress = useQuery({
    queryKey: ["progress", d.id],
    queryFn: () => api<{ progress: PlaybackProgress[] }>(`/api/progress/${d.id}`),
    enabled: signedIn,
  });

  const candidates = useMemo<Candidate[]>(() => {
    if (!avail.data) return [];
    // Files this browser can play untouched come first; transcodes and incompatible files last.
    const list = orderedSources(avail.data, undefined, audioLangs, voiceStudios, copyAudio).flatMap(({ server: s }): Candidate[] => {
      // A torrent file bound to another episode is not a source for this one; nor a whole torrent whose release name holds
      // other seasons only (a season-1 pack for season 2): with nothing left, the sources screen searches this season.
      if (s.kind === "torrserver" && s.season !== null && (s.season !== season || s.episode !== episode)) return [];
      if (d.kind === "tv" && season !== null && s.season === null && !holdsByName(s, season)) return [];
      return [toCandidate(s)];
    });
    // Within TorrServer: files bound to exactly this film/episode first (the server lists the latest choice first),
    // then whole torrents; a torrent whose file is already bound here is not listed twice.
    const bound = new Set(list.filter(isBound).map((c) => `${c.server.connectionId}:${hashOf(c.server.externalId)}`));
    const torrents = list.filter((c) => c.provider === "torrserver" && (isBound(c) || !bound.has(c.key)));
    const ordered = [...torrents.filter(isBound), ...torrents.filter((c) => !isBound(c))];
    let i = 0;
    return list.flatMap((c) => (c.provider !== "torrserver" ? [c] : isBound(c) || !bound.has(c.key) ? [ordered[i++]!] : []));
  }, [avail.data, season, episode, audioLangs, voiceStudios, d.kind]);

  const saved = progress.data?.progress.find((x) => x.season === season && x.episode === episode);
  const resumeAt = resumeOverride.current ?? castStart.current ?? (saved && !saved.completed && saved.positionSec > 30 ? saved.positionSec : 0);

  const connOf = useCallback(
    (s: Availability) =>
      conns.data?.connections.find((x) => x.id === s.connectionId) ?? {
        id: s.connectionId,
        kind: s.kind,
        settings: { syncProgressToServer: false, importWatchedFromServer: false, maxBitrateKbps: null, preferDirectPlay: true, autoSearch: true },
      },
    [conns.data],
  );
  // A copy in words (PLR-05): its version, never its server's name alone.
  const versionOf = useCallback((c: Candidate) => copyText.version(c.server, avail.data?.servers ?? [], d.originalLanguage), [copyText, avail.data, d.originalLanguage]);
  // A copy's row title (7.15): its quality marks, then what they don't say and what is heard (QualityLine).
  const titleOf = useCallback(
    (c: Candidate) => {
      const q = copyText.quality(c.server, avail.data?.servers ?? [], d.originalLanguage);
      return <QualityLine marks={q.marks} words={q.words} />;
    },
    [copyText, avail.data, d.originalLanguage],
  );
  /** What a preparation starts: "1080p · WEB-DL · Russian · dubbed — torr". */
  const labelOf = useCallback((c: Candidate) => `${versionOf(c)} — ${c.label}`, [versionOf]);

  /**
   * Keeps the URL in step with an explicit choice, so a reload starts the same source. Native
   * history (synced with useSearchParams by Next) — a router navigation would restart this playback.
   */
  const setUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const u = new URL(window.location.href);
      for (const [k, v] of Object.entries(patch)) (v === null ? u.searchParams.delete(k) : u.searchParams.set(k, v));
      // On a TV the shell's own way, so its history (Back) counts no new screen.
      if (tvNav) tvNav.replaceQuery(u.searchParams);
      else window.history.replaceState(null, "", u.pathname + u.search);
    },
    [tvNav],
  );

  const refetchAvailability = avail.refetch;
  /** `matched`: the person chose the torrent, its files were matched (see TorrentBind). Null when the bind failed. */
  const bind = useCallback(
    (connectionId: string, entries: { season: number | null; episode: number | null; externalId: string; label: string | null }[], replace: boolean, matched = false) =>
      entries.length === 0
        ? Promise.resolve(null)
        : api<TorrentBindResult>(`/api/connections/${connectionId}/index/bind`, { method: "POST", json: { titleId: d.id, entries, replace, matched } }).then(
            (r) => {
              void refetchAvailability();
              return r;
            },
            () => null,
          ),
    [d.id, refetchAvailability],
  );

  /**
   * The file to play from a torrent source: the file bound to this film/episode, or one found with
   * certainty (then bound, so the next start goes straight to it). Otherwise the torrent's files go
   * to the person — never the first or biggest file in place of the requested one.
   */
  const resolveTorrent = useCallback(
    async (c: Candidate, explicit: boolean, load = true): Promise<{ externalId: string; file: string; videos: number | null } | TorrentFiles> => {
      const s = c.server;
      if (s.externalId.includes(":")) return { externalId: s.externalId, file: s.label ?? "", videos: null };
      const ts = (await clientFor(connOf(s))) as ReturnType<typeof torrServerClient>;
      const { title, files } = await ts.files(s.externalId, load);
      // Not started on the server and not to be (`load` false): its files aren't known — the caller passes it by.
      if (files.length === 0 && !load) throw new Error("torrent not loaded");
      // The release's name (the index keeps it): a torrent added before SRC-06 has only the film's name on the server.
      const name = s.label || title || "";
      // How this release numbers the seasons, for numbering the series as releases do (kids profiles send nothing).
      if (d.kind === "tv" && !isKids) reportNumbering(d.id, "files", filesNumbering(files, name));
      const found = d.kind === "tv" && season !== null && episode !== null ? matchEpisode(files, name, season, episode) : pickMovieFile(files, d.year);
      if (found.status === "match") {
        const externalId = `${s.externalId}:${found.file.id}`;
        // An explicit choice of this torrent replaces the episode's earlier file; an automatic match only fills a gap.
        const bound = bind(s.connectionId, [{ season, episode, externalId, label: (d.kind === "tv" ? fileName(found.file) : name).slice(0, 190) }], explicit, true);
        // An episode's file the person unlinked is never matched back silently: they pick its file (or another source).
        if (d.kind === "tv" && season !== null && episode !== null && (await bound)?.refused.includes(externalId)) {
          return { candidate: c, hash: s.externalId, title: name, files: episodeFiles(files, name, season, episode).candidates, reason: "unlinked" };
        }
        return { externalId, file: fileName(found.file), videos: files.filter((f) => isVideoFile(f.path)).length };
      }
      return { candidate: c, hash: s.externalId, title: name, files: found.candidates, reason: found.status };
    },
    [connOf, d.kind, d.id, d.year, isKids, season, episode, bind],
  );

  // In words, never an engine's or a server's own (English) message (8.5, L10N-04).
  const errorText = useCallback(
    (e: unknown) =>
      e instanceof ShownError
        ? e.message
        : e instanceof TorrentFileMissing
          ? t("errorFileGone")
          : e instanceof MediaNetError
            ? e.code === "auth"
              ? t("errorAuth")
              : e.code === "timeout" || e.code === "unreachable"
                ? t("errorNetwork")
                : mediaError(e)
            : e instanceof ApiRequestError
              ? mediaError(e)
              : t("errorUnknown"),
    [t, mediaError],
  );
  /** Why a file needs another player, in words (PLR-06, PLR-08). */
  const reasonText = useCallback(
    (note: string | null) => {
      const words = why(note);
      return words.length ? words.join(". ") : null;
    },
    [why],
  );

  /** How a prepared stream will reach the screen, in a few words, and the dubbing's track when one was chosen. */
  const methodFact = useCallback(
    (p: PreparedPlayback) =>
      [
        p.type === "remux" ? t("probeRebuilt") : p.method === "direct" ? t("probeDirect") : p.method === "remux" ? t("probeServerRemux") : p.method === "transcode" ? t("probeTranscode") : t("probeExternal"),
        p.voice?.match === "playing" ? t("probeVoice", { studio: p.voice.studio }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    [t],
  );

  /**
   * Starts a candidate stage by stage, each shown as it happens. `added`: what the add stage found, when
   * the release was just added from search. `touch`: an explicit choice, remembered as the copy to start
   * first next time — only once it has been prepared, so a replacement that fails changes nothing.
   */
  const prepare = useCallback(
    async (start: Candidate, opts: { auto: boolean; audioIndex?: number; added?: string | null; touch?: boolean; fromScreen?: boolean; rebuild?: boolean }) => {
      pendingReopen.current?.();
      const my = ++attempt.current;
      const live = () => attempt.current === my;
      prepAbort.current?.abort();
      const ctrl = new AbortController();
      prepAbort.current = ctrl;
      preparingKey.current = start.key;
      let c = start;
      if (opts.fromScreen) keepPlace(document.activeElement);
      setCurrent(c);
      preparing.current = true;
      const prep: Prep = { stages: stagesFor({ provider: c.provider, bound: isBound(c) }, { added: Boolean(opts.added), episode: d.kind === "tv" }), at: "probe", facts: {} };
      if (opts.added) prep.facts.add = opts.added;
      const show = (at: PrepStage) => {
        if (!live()) return;
        prep.at = at;
        setPhase({ kind: "preparing", candidate: c, label: labelOf(c), prep: { ...prep, facts: { ...prep.facts } }, fromScreen: Boolean(opts.fromScreen) });
      };
      try {
        let prepared: PreparedPlayback;
        {
          let externalId = c.server.externalId;
          if (c.provider === "torrserver") {
            show(isBound(c) ? "file" : "files");
            let r = await resolveTorrent(c, !opts.auto);
            if (!live()) return;
            const asked: TorrentFiles[] = [];
            if ("files" in r && opts.auto && d.kind === "tv") {
              // Nothing was chosen explicitly: look for the episode in this title's other torrents before asking — those
              // whose names say they hold this season first, three at most, each read from the server's database only:
              // no torrent is started (up to a minute each) for the look.
              asked.push(r);
              const says = (x: Candidate) => season !== null && Boolean(x.server.label) && holdsSeason(packOf(x.server.label!), season) === true;
              const others = candidates
                .filter((x) => x.provider === "torrserver" && !isBound(x) && x.key !== c.key)
                .sort((a, b) => Number(says(b)) - Number(says(a)))
                .slice(0, 3);
              for (const other of others) {
                // A torrent that can't be read, or isn't started on the server, is passed by: the others are still asked.
                const o = await optional(resolveTorrent(other, false, false), null);
                if (!live()) return;
                if (!o) continue;
                if ("externalId" in o) {
                  c = other;
                  r = o;
                  setCurrent(c);
                  break;
                }
                asked.push(o);
              }
            } else if ("files" in r) asked.push(r);
            if ("files" in r) {
              // The file stage waits for the person: the torrent's files are offered.
              setPhase({ kind: "pickFile", torrents: asked, added: opts.added ?? null });
              return;
            }
            if (r.videos !== null) prep.facts.files = t("stageFilesFact", { count: r.videos });
            // The file's own name; a file bound earlier is labelled with its release's name — said as the version.
            prep.facts.file = r.file && r.file !== c.server.label ? r.file : versionOf(c);
            externalId = r.externalId;
          } else if (d.kind === "tv" && season !== null && episode !== null) {
            show("file");
            const client = await clientFor(connOf(c.server));
            if (client.findEpisode) {
              const id = await client.findEpisode(externalId, season, episode);
              if (!id) throw new ShownError(t("episodeMissing", { season, episode }));
              externalId = id;
            }
            if (!live()) return;
            prep.facts.file = versionOf(c);
          }
          show("probe");
          // `c` may have moved to another torrent of this title above.
          const client = await clientFor(connOf(c.server));
          // resumeOverride may have been set just now (another audio track from the current position).
          prepared = await client.prepare(externalId, {
            startSec: resumeOverride.current ?? resumeAt,
            audioIndex: opts.audioIndex,
            voice: c.provider === "torrserver" ? wishedVoice.current : null,
            profile: c.provider === "torrserver" ? heard.current : null,
            rebuild: opts.rebuild,
            signal: ctrl.signal,
          });
        }
        if (!live()) return;
        prep.facts.probe = methodFact(prepared);
        prep.at = "play";
        lastPrep.current = { label: labelOf(c), prep: { ...prep, facts: { ...prep.facts } } };
        if (opts.touch) background(api(`/api/connections/${c.server.connectionId}/index/touch`, { method: "POST", json: { titleId: d.id, externalId: c.server.externalId } }));
        // The file's audio tracks, kept with the torrent: its release name may not name the studios ("6x MVO") the
        // sources screen and the copy's heading then pick and say. Sent only when they differ from what is kept.
        if (c.provider === "torrserver" && signedIn && !isKids && prepared.audio.length > 0) {
          const tracks = prepared.audio.slice(0, 32).map((a) => `${a.lang ?? ""}|${a.label}`.slice(0, 160));
          if ((c.server.quality?.audioTracks ?? []).join("\n") !== tracks.join("\n"))
            background(api(`/api/connections/${c.server.connectionId}/index/tracks`, { method: "POST", json: { hash: hashOf(c.server.externalId).toLowerCase(), tracks } }).then(() => invalidateAvailability(qc)));
        }
        // No track could be told to be the chosen dubbing: the default plays, and the person is told so.
        if (prepared.voice?.match === "unknown") toast.info(t("voiceTrackUnknown", { studio: prepared.voice.studio }));

        if (prepared.method === "external") {
          setPhase({ kind: "external", candidate: c, prepared, reason: reasonText(prepared.incompatibility) });
          background(
            reportPlayback({ provider: c.provider, method: "external", outcome: "fallback", errorCode: prepared.incompatibility?.slice(0, 60) ?? null, container: null, videoCodec: null, audioCodec: null, platform: detectCapabilities().platform }),
          );
          return;
        }
        // A plain stream from a TorrServer with a password needs the service worker bridge; without it, go external.
        // (A rebuilt one fetches with the password itself.)
        if (c.provider === "torrserver" && prepared.type !== "remux" && prepared.url.startsWith("/__ts/") && !navigator.serviceWorker?.controller) {
          setPhase({ kind: "external", candidate: c, prepared, reason: t("swRequired") });
          return;
        }
        lastGood.current = { candidate: c, voice: new URL(window.location.href).searchParams.get("voice") };
        // From the press of "Watch" — the add, the player's page and the probe included.
        startClock.current = launchSince() ?? performance.now();
        setActive({ candidate: c, prepared });
        setPhase({ kind: "playing" });
        // Dolby Vision 5 here plays with wrong colours (PLR-15): said at once, with the way to another app.
        if (prepared.warning === "dv5")
          toast.info(t("dv5Warning"), { action: { label: t("openExternal"), onClick: () => setPhase({ kind: "external", candidate: c, prepared, reason: t("why_dv5") }) } });
      } catch (e) {
        if (!live()) return;
        failed.current.add(c.key);
        const failedAt = c;
        const base = { kind: "error" as const, candidate: c, label: labelOf(c), prep: { ...prep, facts: { ...prep.facts } }, fromScreen: Boolean(opts.fromScreen) };
        // A torrent the server answers 404 for may be gone from it: its full list decides (SRC-03, TS7).
        if (c.provider === "torrserver" && e instanceof MediaNetError && e.code === "http" && e.status === 404) {
          const hash = hashOf(c.server.externalId).toLowerCase();
          const presence = await torrentPresence(c.server.connectionId, hash);
          if (!live()) return;
          if (presence === "gone") {
            setPhase({ ...base, message: t("errorGone", { server: c.label }), retry: null, gone: { connectionId: c.server.connectionId, hash }, cause: "missing" });
            return;
          }
        }
        const auth = e instanceof MediaNetError && e.code === "auth";
        // A TV's browser refusing an http:// server: the server's address is changed on a phone (the TV's "Check the
        // connection" shows the way there); repeating can't help.
        const blocked = Boolean(tvNav) && e instanceof MediaNetError && e.code === "mixed_content";
        setPhase({
          ...base,
          message: errorText(e),
          cause: blocked
            ? "blocked"
            : auth
              ? "auth"
              : e instanceof TorrentFileMissing || e instanceof ShownError
                ? "missing"
                : e instanceof MediaNetError && (e.code === "timeout" || e.code === "unreachable")
                  ? "unreachable"
                  : "other",
          auth: auth || blocked,
          // Repeating can't bring back a file the torrent doesn't have, or fix a refused sign-in.
          retry: auth || blocked || e instanceof TorrentFileMissing ? null : () => void prepare(failedAt, { ...opts, auto: false }),
        });
      } finally {
        if (live()) {
          preparing.current = false;
          preparingKey.current = null;
        }
      }
    },
    [candidates, connOf, d.id, d.kind, season, episode, resumeAt, resolveTorrent, errorText, methodFact, keepPlace, labelOf, versionOf, reasonText, t, tvNav, signedIn, isKids, qc],
  );

  /** "Cancel" while preparing (SRC-18): the preparation stops at its next step and the screen comes back as it was. */
  const cancel = () => {
    attempt.current++;
    prepAbort.current?.abort();
    preparing.current = false;
    preparingKey.current = null;
    takeBackBrought();
    setPhase({ kind: "choose" });
    requestAnimationFrame(toList);
  };

  /**
   * Before a torrent is removed from the server (the screen's "Remove from TorrServer…" over the player): the player
   * that streams it, or the preparation that reads it, lets it go — stopped, unmounted, no reopen waiting — so no request
   * by its hash comes after the removal and adds it back, nameless.
   */
  const releaseTorrents = async (hashes: string[]) => {
    const reads = (c: Candidate | null | undefined) => c?.provider === "torrserver" && hashes.includes(hashOf(c.server.externalId).toLowerCase());
    if (brought.current && hashes.includes(brought.current.hash)) brought.current = null;
    if (!reads(active?.candidate) && !(preparing.current && reads(current))) return;
    pendingReopen.current?.();
    attempt.current++;
    prepAbort.current?.abort();
    preparing.current = false;
    preparingKey.current = null;
    setActive(null);
    setPhase({ kind: "choose" });
    await new Promise((done) => window.setTimeout(done, 800));
  };

  /**
   * The person picked this source: the URL follows at once (a reload starts the same source), and once
   * it is prepared it is remembered as the copy to start first. A release just found carries the dubbing
   * it was picked for; an existing source plays its own default.
   */
  const choose = useCallback(
    (c: Candidate, voice: string | null = null, added: string | null = null) => {
      // A second press on the "Watch" of the copy being prepared starts nothing again.
      if (preparing.current && preparingKey.current === c.key) return;
      // Another source: a torrent this launch brought and that never played goes back.
      takeBackBrought(c.provider === "torrserver" ? `${c.server.connectionId}:${hashOf(c.server.externalId).toLowerCase()}` : undefined);
      wishedVoice.current = voiceWish(voice);
      setUrl({ source: c.key, pick: null, voice });
      void prepare(c, { auto: false, added, touch: true, fromScreen: true });
    },
    [prepare, setUrl, takeBackBrought],
  );

  /**
   * A release picked in the search: added to the TorrServer (its own stage, retried on its own when it
   * fails) unless it is there already, then started like any other copy.
   */
  const addAndPlay = useCallback(
    async (pick: FinderPick, anchor: Element | null = null) => {
      if (preparing.current) return;
      keepPlace(anchor ?? document.activeElement);
      const server = conns.data?.connections.find((x) => x.id === pick.connectionId)?.name ?? "TorrServer";
      let hash = pick.result.hash;
      let label = pick.result.title.slice(0, 190);
      if (!pick.linked || !hash) {
        const my = ++attempt.current;
        preparing.current = true;
        const prep: Prep = { stages: stagesFor({ provider: "torrserver", bound: false }, { added: true, episode: d.kind === "tv" }), at: "add", facts: {} };
        setPhase({ kind: "preparing", candidate: null, label: `${pick.version} — ${server}`, prep, fromScreen: true });
        try {
          const added = await addTorrentSource(pick.connectionId, d, season, pick.result);
          if (attempt.current !== my) return;
          if (!added) throw new ShownError(t("addFailed"));
          ({ hash, label } = added);
          if (!added.existed) {
            takeBackBrought(`${pick.connectionId}:${added.hash}`);
            brought.current = { connectionId: pick.connectionId, hash: added.hash };
          }
        } catch (e) {
          if (attempt.current !== my) return;
          const message = e instanceof ShownError ? e.message : e instanceof MediaNetError && e.code === "http" && e.status ? t("addFailedStatus", { status: e.status }) : mediaError(e);
          setPhase({ kind: "error", candidate: null, label: `${pick.version} — ${server}`, message, prep, retry: () => void addAndPlay(pick), fromScreen: true });
          return;
        } finally {
          if (attempt.current === my) preparing.current = false;
        }
      }
      void avail.refetch();
      const s: Availability = { connectionId: pick.connectionId, kind: "torrserver", connectionName: server, externalId: hash, label, season: null, episode: null, quality: null };
      choose(toCandidate(s), pick.voice, t(pick.linked ? "stageAlreadyAdded" : "stageAddedFact", { server }));
    },
    [conns.data, d, season, avail, choose, keepPlace, t, mediaError, takeBackBrought],
  );

  const pickFile = useCallback(
    async (tf: TorrentFiles, file: TsFile | EpisodeFile, added: string | null) => {
      const s = tf.candidate.server;
      const externalId = `${tf.hash}:${file.id}`;
      await bind(s.connectionId, [{ season, episode, externalId, label: (d.kind === "tv" ? fileName(file) : tf.title).slice(0, 190) }], true);
      // Confirming a file whose season was unknown confirms the torrent's season: its other numbered
      // files are bound to the same season, but only for episodes that have no file yet.
      if (d.kind === "tv" && "parsed" in file && file.parsed && file.parsed.season === null) {
        const rest = tf.files.filter((f): f is EpisodeFile => "parsed" in f && f.id !== file.id && f.parsed !== null && f.parsed.season === null);
        void bind(s.connectionId, rest.map((f) => ({ season, episode: f.parsed!.episode, externalId: `${tf.hash}:${f.id}`, label: fileName(f).slice(0, 190) })), false);
      }
      const c = toCandidate({ ...s, externalId, season, episode, label: d.kind === "tv" ? fileName(file) : s.label });
      setUrl({ source: null, pick: null });
      void prepare(c, { auto: false, added, fromScreen: true });
    },
    [bind, d.kind, season, episode, prepare, setUrl],
  );

  // "Remove the copy" of a torrent its server no longer has (SRC-03): Lumovio's links to it go; nothing is sent to the server.
  const forget = useAction({
    run: async (g: { connectionId: string; hash: string }) => {
      const [r] = await forgetTorrents(g.connectionId, [g.hash]);
      if (r?.status !== "removed") throw r?.error ?? new Error("forget failed");
    },
    success: () => t("copyForgotten"),
    sync: async () => {
      invalidateAvailability(qc);
      await avail.refetch();
      setPhase({ kind: "choose" });
    },
  });

  // Auto-start: the explicitly requested source, else the first candidate — unless the sources screen was asked for.
  useEffect(() => {
    if (phase.kind !== "loading") return;
    if (avail.isError) return setPhase({ kind: "choose" });
    if (!avail.data || (signedIn && (progress.isLoading || (conns.isLoading && !isKids)))) return;
    if (picking) return setPhase({ kind: "choose" });
    const sameTorrent = (c: Candidate) => Boolean(wanted?.startsWith(`${c.server.connectionId}:${hashOf(c.server.externalId)}`));
    const exact = wanted ? candidates.find((c) => c.key === wanted) : undefined;
    // A copy sent from a phone that this TV doesn't have: the sources screen here, and the phone is told (8.18).
    const pick = exact ?? (wanted ? candidates.find(sameTorrent) : undefined) ?? (castId && wanted ? undefined : candidates[0]);
    // "?added=1": the title page has just added this release, the first of its stages.
    const added = pick && params.get("added") === "1" ? t("stageAddedFact", { server: pick.label }) : null;
    // "?brought=1": that add brought the torrent to the server (it wasn't there): taken back if it never plays.
    if (pick?.provider === "torrserver" && params.get("brought") === "1") brought.current = { connectionId: pick.server.connectionId, hash: hashOf(pick.server.externalId).toLowerCase() };
    if (params.has("added") || params.has("brought")) setUrl({ added: null, brought: null });
    if (pick) void prepare(pick, { auto: !exact, added, audioIndex: castAudio.current });
    else {
      if (castId) setCastMiss(wanted ? "missing" : "none");
      setPhase({ kind: "choose" });
    }
  }, [phase.kind, avail.data, avail.isError, candidates, wanted, picking, prepare, signedIn, progress.isLoading, conns.isLoading, isKids, params, setUrl, t, castId]);

  const playingNow = phase.kind === "playing" ? active : null;
  const report = useCallback(
    (event: "start" | "progress" | "pause" | "stop" | "complete", positionSec: number, durationSec: number | null, beacon = false) => {
      if (!signedIn || !playingNow) return null;
      const body = {
        titleId: d.id,
        season,
        episode,
        positionSec: Math.max(0, positionSec),
        durationSec: durationSec && Number.isFinite(durationSec) ? durationSec : null,
        event,
        playbackSessionId: sessionId.current,
        seq: ++seq.current,
        source: `lumovio_player:${playingNow.candidate.provider}`,
        clientTime: Date.now(),
      };
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/progress", new Blob([JSON.stringify(body)], { type: "application/json" }));
        return null;
      }
      return api("/api/progress", { method: "POST", json: body });
    },
    [signedIn, playingNow, d.id, season, episode],
  );

  // Flush the last position when the tab is hidden or closed.
  const last = useRef<{ pos: number; dur: number | null }>({ pos: 0, dur: null });
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && last.current.pos > 0) report("pause", last.current.pos, last.current.dur, true);
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [report]);

  // The end of the film: the watch goes into the history, and the end screen says whether it did (PLR-04).
  const complete = (pos: number, dur: number | null) => {
    const sent = report("complete", pos, dur);
    if (!sent) return;
    setMarked("pending");
    sent.then(
      () => setMarked("done"),
      () => setMarked("failed"),
    );
  };
  const retryMark = () => {
    setMarked("pending");
    api("/api/history/mark", { method: "POST", json: { titleId: d.id, season, episode, watched: true } }).then(
      () => setMarked("done"),
      () => setMarked("failed"),
    );
  };

  const nextEp = useMemo(() => {
    if (d.kind !== "tv" || season === null || episode === null) return null;
    const s = d.seasons.find((x) => x.seasonNumber === season);
    if (s && episode < s.episodeCount) return { season, episode: episode + 1 };
    const ns = d.seasons.find((x) => x.seasonNumber === season + 1);
    return ns ? { season: season + 1, episode: 1 } : null;
  }, [d, season, episode]);
  // The next episode's name for its card (PLR-11): the same query as the title page's season browser and the episodes panel.
  const nextSeason = useQuery({
    queryKey: ["season", d.tmdbId, nextEp?.season ?? 0, locale],
    queryFn: () => api<SeasonDetails>(`/api/catalog/tv/${d.tmdbId}/season/${nextEp!.season}`),
    enabled: nextEp !== null,
    staleTime: 30 * 60_000,
  });
  // A profile that hides the names (or stills) of unwatched episodes (8.12) gets the number only (the still blurred).
  const spoilers = useSpoilerPrefs();
  const watched = useLibraryState(d.id).data?.watchedEpisodes;
  const nextOpen = nextEp ? episodesOpen(watched)(nextEp.season, nextEp.episode) : false;
  const nextData = nextEp ? nextSeason.data?.episodes.find((e) => e.episodeNumber === nextEp.episode) : undefined;
  const nextName = nextEp && !(spoilers.names && !nextOpen) ? nextData?.name : undefined;
  // The episode playing, named under the title (the same season query, usually cached by the title page).
  const thisSeason = useQuery({
    queryKey: ["season", d.tmdbId, season ?? 0, locale],
    queryFn: () => api<SeasonDetails>(`/api/catalog/tv/${d.tmdbId}/season/${season}`),
    enabled: season !== null,
    staleTime: 30 * 60_000,
  });
  const episodeName = season !== null ? thisSeason.data?.episodes.find((e) => e.episodeNumber === episode)?.name : undefined;
  /** A progress report in the background: the next beat carries the position again. */
  const send = (...args: Parameters<typeof report>) => {
    const p = report(...args);
    if (p) background(p);
  };

  // To the title; on a TV back to the screen the viewing was opened from (the title, the home's Continue), so Back
  // from there never starts the player again.
  // Back to the title it came from, not a new entry (useGoUp): the title's and the app's Back mustn't lead here again.
  const toTitle = () => (tvNav ? tvNav.leave(titleHref(d.kind, d.tmdbId, d.title)) : goUp(titleHref(d.kind, d.tmdbId, d.title)));
  // Picking a file: why it is asked — the episode's file was unlinked, is ambiguous, or isn't in the torrents.
  const fileTitle = (torrents: TorrentFiles[]) =>
    d.kind === "tv"
      ? t(torrents.some((x) => x.reason === "unlinked") ? "episodeFileUnlinked" : torrents.some((x) => x.reason === "ambiguous") ? "pickEpisodeFile" : "episodeNotInTorrents", {
          season: season ?? 0,
          episode: episode ?? 0,
        })
      : t("pickMovieFile");
  const episodeLabel = d.kind === "tv" && season !== null && episode !== null ? t("episodeLabel", { season, episode }) : null;
  const subtitle = episodeLabel ? [episodeLabel, episodeName].filter(Boolean).join(" · ") : d.year ? String(d.year) : null;
  const here = `/watch/${d.kind}/${d.tmdbId}${season !== null ? `?s=${season}&e=${episode}` : ""}`;
  // The dubbing chosen for this viewing goes on to the series' other episodes (their files have the same tracks).
  const voiceParam = params.get("voice");
  const epHref = (s: number, e: number) => `/watch/tv/${d.tmdbId}?s=${s}&e=${e}${voiceParam ? `&voice=${encodeURIComponent(voiceParam)}` : ""}`;
  // Why there is nothing to play, in the same words as the title page.
  const ws = avail.state;
  const whyNothing =
    ws.kind === "guest"
      ? tt("statusGuest")
      : ws.kind === "noServers"
        ? isKids
          ? tt("statusKidsNone")
          : tt("statusNoServers")
        : ws.kind === "notInLibrary"
          ? tt("statusNotInLibrary", { count: ws.servers })
          : ws.kind === "unreachable"
            ? tt("statusUnreachable", { names: ws.names.join(", ") })
            : ws.kind === "indexing"
              ? tt("statusIndexing", { names: ws.names.join(", ") })
              : ws.kind === "error"
                ? tt("statusError")
                : t("noSourcesText");
  // Only the TorrServers this profile may use (SRC-11): availability lists the profile's own connections.
  const mine = useMemo(() => new Set((avail.data?.sources ?? []).filter((s) => s.kind === "torrserver").map((s) => s.id)), [avail.data]);
  const torrServers = (conns.data?.connections ?? []).filter((c) => c.kind === "torrserver" && mine.has(c.id));
  const linked = useMemo(
    () => new Set((avail.data?.servers ?? []).filter((s) => s.kind === "torrserver").map((s) => `${s.connectionId}:${hashOf(s.externalId).toLowerCase()}`)),
    [avail.data],
  );
  // What the title page had picked when it opened this screen (audio, picture version, quality mode).
  const quality = params.get("quality");
  // The cut chosen on the title page comes too: the screen starts in it, as its pill says.
  const finderStart = { voice: params.get("voice"), picture: params.get("picture"), quality: quality !== null && Object.hasOwn(QUALITY_MODES, quality) ? (quality as ReleaseQuality) : null, edition: params.get("edition") };
  const finderShown = signedIn && !isKids && torrServers.length > 0;
  // The audio tracks the player read in this title's copies on the profile's TorrServers: a search result that is the
  // same release (by its hash, or the name the copy was saved under) takes its studios from the file ("6x MVO").
  const filesOf = useMemo(() => {
    const m = new Map<string, readonly string[]>();
    const torrents = (avail.data?.servers ?? []).filter((s) => s.kind === "torrserver");
    // Any entry of the torrent may hold them (its file bound to the film, the torrent's own entry added again).
    for (const s of torrents) if (s.quality?.audioTracks?.length) m.set(`hash:${hashOf(s.externalId).toLowerCase()}`, s.quality.audioTracks);
    for (const s of torrents) {
      const tracks = s.quality?.audioTracks?.length ? s.quality.audioTracks : m.get(`hash:${hashOf(s.externalId).toLowerCase()}`);
      if (tracks && s.label) m.set(`name:${s.label}`, tracks);
    }
    return m;
  }, [avail.data]);
  const fileTracksOf = useCallback(
    (r: { hash: string | null; title: string }) => (r.hash ? filesOf.get(`hash:${r.hash.toLowerCase()}`) : undefined) ?? filesOf.get(`name:${r.title.slice(0, 190)}`) ?? null,
    [filesOf],
  );
  const finderProps: FinderProps = {
    details: d,
    season,
    episode,
    connections: torrServers,
    defaultConnectionId: (active?.candidate ?? current)?.provider === "torrserver" ? (active?.candidate ?? current)!.server.connectionId : null,
    existing: linked,
    fileTracks: filesOf.size ? fileTracksOf : undefined,
    start: finderStart,
    autoStart: phase.kind === "choose" && (picking || candidates.length === 0),
    onPick: (pick, anchor) => void addAndPlay(pick, anchor),
  };

  // On a TV a preparation started from the sources screen is shown there, from the top; the screen's place is kept
  // for going back to it ("another source" after a failure). The site's goes to the launch scene (./launch).
  const prepFromScreen = phase.kind === "preparing" && phase.fromScreen;
  useEffect(() => {
    if (prepFromScreen && tvNav) window.scrollTo({ top: 0 });
  }, [prepFromScreen, tvNav]);
  useEffect(() => {
    if (phase.kind === "playing") savedPlace.current = null;
  }, [phase.kind]);
  // A failure takes the focus to its first way out: the control that started it went with the screen (keyboards, remotes).
  useEffect(() => {
    if (phase.kind !== "error") return;
    if (document.activeElement instanceof HTMLInputElement) return;
    const first = document.querySelector<HTMLElement>("#prep-error [role=alert] button, #prep-error [role=alert] a[href]");
    // On a TV through the shell's navigation, which slides the screen to it.
    if (tvNav) tvNav.focus(first);
    else first?.focus({ preventScroll: true });
  }, [phase, tvNav]);
  // Back to the control that was picked, where it stood on the screen, with the focus on it (remotes, keyboards; SRC-19).
  const toList = () => {
    const p = savedPlace.current;
    savedPlace.current = null;
    if (p?.el?.isConnected && p.el instanceof HTMLElement && p.el.closest("#sources, #finder")) {
      if (tvNav) return tvNav.focus(p.el);
      window.scrollBy({ top: p.el.getBoundingClientRect().top - p.top });
      p.el.focus({ preventScroll: true });
      return;
    }
    const to = document.getElementById(candidates.length > 1 || !finderShown ? "sources" : "finder");
    if (tvNav) return tvNav.focus(to?.querySelector<HTMLElement>("button, a[href]") ?? null);
    to?.scrollIntoView();
    to?.querySelector<HTMLElement>("button, a[href]")?.focus({ preventScroll: true });
  };
  const anotherSource = () => {
    setPhase({ kind: "choose" });
    requestAnimationFrame(toList);
  };
  const backToPlayer = () => setPhase({ kind: "playing" });
  // On a TV the sources over a viewing are a step of the history (TV3): Back of a TV browser that keeps Back to itself
  // goes back to watching — a preparation under way is dropped — instead of leaving the player.
  const overPlayer = Boolean(tvNav && active && phase.kind !== "playing");
  const toWatching = useRef(() => {});
  toWatching.current = () => {
    attempt.current++;
    preparing.current = false;
    setPhase({ kind: "playing" });
  };
  useEffect(() => {
    if (!tvNav || !overPlayer) return;
    let own = false;
    const layer = tvNav.openLayer(() => !own && toWatching.current(), { inline: true });
    return () => {
      own = true;
      layer.dismiss();
    };
  }, [tvNav, overPlayer]);

  // The copies for the player's "Source" panel: one of them plays from the same position.
  const sourcesInfo = {
    list: candidates.map((c) => ({ key: c.key, kind: c.provider, title: titleOf(c), meta: copyText.meta(c.server, d.title), current: sameCopy(active?.candidate, c), failed: failed.current.has(c.key) })),
    onPick: (key: string, pos: number) => {
      const c = candidates.find((x) => x.key === key);
      if (!c) return;
      resumeOverride.current = pos > 5 ? pos : resumeOverride.current;
      send("pause", pos, last.current.dur);
      choose(c);
    },
    onSearch: finderShown
      ? (pos: number) => {
          resumeOverride.current = pos > 5 ? pos : resumeOverride.current;
          send("pause", pos, last.current.dur);
          setPhase({ kind: "choose" });
          // The search, with the focus in it (the player's own focus is gone with it).
          requestAnimationFrame(() => {
            const finder = document.getElementById("finder");
            finder?.scrollIntoView();
            const field = document.getElementById("ts-query");
            (field?.getClientRects().length ? field : finder?.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
          });
        }
      : undefined,
  };

  // "Watch on TV" (design-system 8.18). On the TV: what plays is said to the phone that sent it, its "Stop on TV" leaves
  // the player, and where the phone was ("?t=") counts for the first start only (a reload goes on from the progress).
  useCastReport({
    on: Boolean(tvNav) && signedIn,
    castId,
    title: { titleId: d.id, kind: d.kind, tmdbId: d.tmdbId, title: d.title, season, episode },
    status:
      phase.kind === "error"
        ? { failure: phase.cause ?? "other" }
        : phase.kind === "external"
          ? { failure: "external" }
          : active
            ? "video"
            : phase.kind === "choose" && castMiss
              ? { failure: castMiss }
              : "preparing",
    media: active ? `${active.prepared.url}|${active.prepared.type}` : null,
  });
  const leaveForTitle = useRef(() => {});
  leaveForTitle.current = () => {
    // Where it stopped is kept first: the phone's next "Watch on TV" goes on from there.
    const v = document.querySelector("video");
    if (v && v.currentTime > 5) send("pause", v.currentTime, Number.isFinite(v.duration) ? v.duration : last.current.dur);
    toTitle();
  };
  useEffect(() => {
    if (!tvNav) return;
    const stop = () => leaveForTitle.current();
    window.addEventListener("lumovio:cast-stop", stop);
    return () => window.removeEventListener("lumovio:cast-stop", stop);
  }, [tvNav]);
  useEffect(() => {
    if (phase.kind === "playing" && params.has("t")) setUrl({ t: null, audio: null });
  }, [phase.kind, params, setUrl]);
  // On the site: the viewing as it is now — the copy, its dubbing and track, the position — for a TV of the account.
  const castCopy = active?.candidate ?? null;
  const castButton =
    !tvNav && signedIn && castCopy && active
      ? (now: { position: number; audio: number | null; pause: () => void }) => {
          const original = active.prepared.audio.find((a) => a.isDefault)?.index ?? null;
          return (
            <CastButton
              titleId={d.id}
              variant="stage"
              onSent={now.pause}
              target={() => {
                const url = new URL(window.location.href).searchParams;
                const q = url.get("quality");
                return {
                  kind: d.kind,
                  tmdbId: d.tmdbId,
                  season,
                  episode,
                  source: castCopy.key,
                  voice: url.get("voice"),
                  quality: q !== null && Object.hasOwn(QUALITY_MODES, q) ? (q as ReleaseQuality) : null,
                  // A track the person chose here goes along; the file's own default is the TV's to choose.
                  audio: chosenAudio.current !== null || now.audio !== original ? now.audio : null,
                  positionSec: now.position,
                  title: d.title,
                  subtitle,
                };
              }}
            />
          );
        }
      : undefined;

  const player = active && (
    <LumovioPlayer
      onLaunch={(l) => {
        setLaunchDetail(l.detail);
        if (l.started) setStartedFor(active.prepared);
      }}
      key={`${active.prepared.url}|${active.prepared.type}|${active.prepared.remuxAudio ?? ""}`}
      prepared={active.prepared}
      hidden={phase.kind !== "playing"}
      title={d.title}
      subtitle={subtitle}
      poster={tmdbImage(d.backdropPath, "w1280")}
      startAt={resumeAt}
      resumed={resumeOverride.current === null && resumeAt > 0}
      onBack={toTitle}
      originalLanguage={d.originalLanguage}
      logo={d.logo}
      titleId={d.id}
      onAudioChange={
        active.prepared.selectAudio
          ? (i, pos) => {
              resumeOverride.current = pos > 5 ? pos : resumeOverride.current;
              chosenAudio.current = i;
              void prepare(active.candidate, { auto: false, audioIndex: i });
            }
          : undefined
      }
      next={
        nextEp
          ? {
              label: [t("episodeLabel", nextEp), nextName].filter(Boolean).join(" · "),
              // The launch's scene from the press (or the countdown's end), as any "Watch" (11.1 «Запуск»).
              go: () => {
                if (!tvNav) startLaunch();
                router.replace(epHref(nextEp.season, nextEp.episode));
              },
              still: tmdbImage(nextData?.stillPath, "w300"),
              blur: spoilers.stills && !nextOpen,
            }
          : null
      }
      episodes={
        d.kind === "tv" && season !== null && episode !== null
          ? { titleId: d.id, tmdbId: d.tmdbId, seasons: d.seasons.filter((s) => s.episodeCount > 0), season, episode, href: epHref }
          : null
      }
      sources={candidates.length > 1 || sourcesInfo.onSearch ? sourcesInfo : null}
      info={{ version: versionOf(active.candidate), server: `${active.candidate.label} · ${KIND_LABEL[active.candidate.provider]}` }}
      end={
        nextEp
          ? null
          : {
              titleHref: titleHref(d.kind, d.tmdbId, d.title),
              kind: d.kind,
              related: d.related,
              marked: signedIn ? marked : null,
              onRetryMark: retryMark,
            }
      }
      onTime={(pos, dur, paused) => {
        last.current = { pos, dur };
        send("progress", pos, dur);
        active.prepared.reportProgress?.(pos, paused);
      }}
      onPlay={(pos) => {
        // It played: a torrent this launch brought stays.
        brought.current = null;
        // A play counts for the shelf the title was opened from (anonymous, C5; once per open).
        if (seq.current === 0) trackOutcome(d.id, "play");
        send(seq.current === 0 ? "start" : "progress", pos, last.current.dur);
        if (seq.current <= 1) active.prepared.reportStart?.(pos);
        // The start, with the time to the first frame (the admin's playback success and speed).
        if (startClock.current !== null) {
          const ttffMs = Math.min(600_000, Math.round(performance.now() - startClock.current));
          startClock.current = null;
          background(
            reportPlayback({ provider: active.candidate.provider, method: active.prepared.method, outcome: "started", errorCode: null, container: null, videoCodec: null, audioCodec: null, platform: detectCapabilities().platform, ttffMs }),
          );
        }
      }}
      onPause={(pos) => {
        send("pause", pos, last.current.dur);
        active.prepared.reportProgress?.(pos, true);
      }}
      onEnded={(pos) => {
        complete(pos, last.current.dur ?? pos);
        active.prepared.reportStop?.(pos);
      }}
      onFatal={(message, code) => {
        const c = active.candidate;
        const prepared = active.prepared;
        // The stream broke off — a window minimised, a tab in the background, a locked phone, TorrServer letting the torrent
        // go: the same source opens again from where it stopped, with the same audio,
        // without an error screen — up to three times in two minutes; then the error is said.
        const now = Date.now();
        const recent = (reopened.current.get(c.key) ?? []).filter((at) => now - at < 180_000);
        if (c.provider === "torrserver" && (code === 2 || (code === null && BROKE_OFF.test(message))) && recent.length < REOPEN_AFTER.length) {
          reopened.current.set(c.key, [...recent, now]);
          resumeOverride.current = last.current.pos > 5 ? last.current.pos : resumeOverride.current;
          const audioIndex = chosenAudio.current ?? (prepared.type === "remux" ? prepared.remuxAudio : undefined);
          // Each try waits a little longer (the network may take a moment to come back); the page shown again or the
          // network back tries at once. Leaving the page or choosing another source cancels the wait.
          const cancel = () => {
            window.clearTimeout(timer);
            window.removeEventListener("online", reopen);
            document.removeEventListener("visibilitychange", onShown);
            if (pendingReopen.current === cancel) pendingReopen.current = null;
          };
          const reopen = () => {
            cancel();
            setActive(null);
            void prepare(c, { auto: false, audioIndex, rebuild: prepared.type === "remux" });
          };
          const onShown = () => {
            if (document.visibilityState === "visible" && navigator.onLine !== false) reopen();
          };
          const timer = navigator.onLine === false ? undefined : window.setTimeout(reopen, REOPEN_AFTER[recent.length]);
          window.addEventListener("online", reopen);
          document.addEventListener("visibilitychange", onShown);
          pendingReopen.current?.();
          pendingReopen.current = cancel;
          return;
        }
        // A TorrServer file whose plain stream this browser couldn't take (a decoder or the password's service worker
        // failed): once, it is rebuilt in the browser from the same position, where it can be — no loop.
        if (c.provider === "torrserver" && prepared.type === "progressive" && code !== null && !rebuilt.current.has(c.key)) {
          rebuilt.current.add(c.key);
          resumeOverride.current = last.current.pos > 5 ? last.current.pos : resumeOverride.current;
          setActive(null);
          void prepare(c, { auto: false, audioIndex: prepared.audio.find((a) => a.isDefault)?.index, rebuild: true });
          return;
        }
        failed.current.add(c.key);
        background(
          // Without the element's code the failure is the rebuild engine's: its own words, addresses cut, say which
          // step broke (13 "media:?" from iPhones in a week said nothing, admin 2026-10-29).
          reportPlayback({ provider: c.provider, method: prepared.method, outcome: "failed", errorCode: code !== null ? `media:${code}` : `engine:${message.replace(/\w+:\/\/\S+/g, "…").slice(0, 52)}`, container: null, videoCodec: null, audioCodec: null, platform: detectCapabilities().platform }),
        );
        // "Try again" goes on from where it stopped, not from where the page opened.
        resumeOverride.current = last.current.pos > 5 ? last.current.pos : resumeOverride.current;
        // The player failed after every stage before it went through: the failure is the play stage's.
        const stages = lastPrep.current ?? { label: labelOf(c), prep: { stages: ["probe", "play"] as PrepStage[], at: "play" as const, facts: {} } };
        setActive(null);
        setPhase({
          kind: "error",
          candidate: c,
          ...stages,
          // The media element's and the rebuild engine's messages are English and technical: not shown.
          // 4: the format; 3: a decoder that said yes and then couldn't (Firefox and HEVC on some PCs).
          message:
            code === 4
              ? t("errorUnsupportedFile", { reason: reasonText(prepared.methodNote) ?? t("why_otherAny") })
              : code === 3
                ? t("errorUnsupportedFile", { reason: prepared.info?.videoCodec ? t("why_video", { value: prepared.info.videoCodec.toUpperCase() }) : t("why_videoAny") })
                : t("errorUnknown"),
          prepared,
          retry: () => void prepare(c, { auto: false }),
          cause: code === 3 || code === 4 ? "unsupported" : "other",
        });
      }}
      castButton={castButton}
    />
  );

  // The launch (11.1 «Запуск»): from "Watch" to the first frame one scene — the black stage, the loader and what is done
  // now — whichever way the viewing was started: a link from the title or home (the scene came with the press), the
  // sources screen, the next episode, another source or audio from the player. The TV shell keeps its own.
  const launching =
    !tvNav &&
    ((phase.kind === "loading" && !picking) || phase.kind === "preparing" || (phase.kind === "playing" && active !== null && startedFor !== active.prepared));
  const prepNow = phase.kind === "preparing" ? phase.prep.stages.find((x) => stageState(phase.prep, x) === "current") : undefined;
  const alternatives = candidates.length > 1 || finderShown;
  useLaunch(
    launching
      ? {
          // The page's own loading keeps the words already there (an add on the title page went before it).
          status: prepNow ? (prepNow === "file" && season !== null && episode !== null ? t("stage_episode", { season, episode }) : t(`stage_${prepNow}`)) : phase.kind === "loading" ? undefined : null,
          detail: phase.kind === "preparing" ? phase.label : phase.kind === "playing" ? launchDetail : null,
          onBack: toTitle,
          backLabel: t("backToTitle", { title: d.title }),
          // When it takes a while: back to what played (a switch from the player), another source.
          actions:
            (phase.kind === "preparing" && active) || alternatives ? (
              <>
                {phase.kind === "preparing" && active && (
                  <Button variant="secondary" icon={Play} onClick={() => toWatching.current()}>
                    {t("backToWatching")}
                  </Button>
                )}
                {alternatives && (
                  <Button variant="secondary" onClick={phase.kind === "preparing" ? cancel : anotherSource}>
                    {t("anotherSource")}
                  </Button>
                )}
              </>
            ) : undefined,
        }
      : null,
  );

  if (phase.kind === "playing") return player;

  const steps = (p: Prep, failedStep: boolean): Step[] =>
    p.stages.map((s) => {
      const state = stageState(p, s);
      return {
        id: s,
        label: s === "file" && season !== null && episode !== null ? t("stage_episode", { season, episode }) : t(`stage_${s}`),
        state: state === "done" ? "done" : state === "current" ? (failedStep ? "error" : "current") : "pending",
        detail: state === "done" ? p.facts[s] : undefined,
      };
    });

  const playable = (c: Candidate) => !failed.current.has(c.key) && sourceRank(detectCapabilities(), { server: c.server }) < 3;
  const inBrowser = phase.kind === "external" ? candidates.find((c) => c.key !== phase.candidate.key && playable(c)) : undefined;
  const fileMeta = (f: TsFile | EpisodeFile) => {
    const parsed = "parsed" in f ? f.parsed : null;
    return [
      parsed ? (parsed.season === null ? t("fileEpisodeOnly", { episode: parsed.episode }) : t("episodeLabel", { season: parsed.season, episode: parsed.episode })) : null,
      formatSize(f.length, locale),
      f.path.includes("/") ? f.path.split("/").slice(0, -1).join("/") : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const external =
    phase.kind === "external" ? (
      <ExternalPlayerPanel
        prepared={phase.prepared}
        title={d.title}
        reason={phase.reason}
        onFinished={() => send("complete", phase.prepared.durationSec ?? 0, phase.prepared.durationSec)}
        titleId={d.id}
        season={season}
        episode={episode}
        inBrowser={inBrowser ? { version: versionOf(inBrowser), play: () => choose(inBrowser) } : null}
      />
    ) : null;
  const finderOn = finderShown && (phase.kind === "choose" || phase.kind === "error" || phase.kind === "external" || phase.kind === "pickFile" || (phase.kind === "preparing" && phase.fromScreen));

  // The TV shell: the same viewing in the TV's composition (design-system 10.3 «Экран источников», S57).
  if (tvNav) {
    const errorActions = (p: Extract<Phase, { kind: "error" }>): TvAction[] => [
      ...(p.retry ? [{ label: tc("retry"), icon: RefreshCw, run: p.retry }] : []),
      ...(p.gone ? [{ label: t("forgetCopy"), icon: Link2Off, run: () => void forget.run(p.gone!), loading: forget.pending }] : []),
      // A server's sign-in is checked on a phone (the shell's "Continue on your phone").
      ...(p.auth ? [{ label: tt("checkConnection"), icon: Settings2, run: () => tvNav.navigate("/settings/connections") }] : []),
      ...(candidates.length > 1 || finderShown ? [{ label: t("anotherSource"), run: anotherSource }] : []),
      ...(active ? [{ label: t("backToWatching"), icon: Play, run: backToPlayer }] : []),
      ...(!active && lastGood.current && lastGood.current.candidate.key !== p.candidate?.key
        ? [{ label: t("backToSource", { source: versionOf(lastGood.current.candidate) }), run: () => choose(lastGood.current!.candidate, lastGood.current!.voice) }]
        : []),
      ...(p.candidate && p.prepared?.externalUrl
        ? [{ label: t("openExternal"), icon: ExternalLink, run: () => setPhase({ kind: "external", candidate: p.candidate!, prepared: p.prepared!, reason: reasonText(p.prepared!.methodNote) }) }]
        : []),
    ];
    const listed = phase.kind === "choose" || phase.kind === "error" || phase.kind === "external";
    return (
      <>
        {player}
        <TvSources
          title={d.title}
          posterPath={d.posterPath}
          subtitle={[t("sourcesHeading"), episodeLabel].filter(Boolean).join(" · ")}
          back={{ label: active ? t("backToWatching") : t("backToTitle", { title: d.title }), run: active ? backToPlayer : toTitle }}
          toPlayer={active ? backToPlayer : null}
          loading={phase.kind === "loading"}
          preparing={phase.kind === "preparing" ? { label: phase.label, steps: steps(phase.prep, false), cancel } : null}
          error={phase.kind === "error" ? { label: phase.label, steps: steps(phase.prep, true), title: t(phase.gone ? "errorGoneTitle" : "errorTitle"), message: phase.message, actions: errorActions(phase) } : null}
          files={
            phase.kind === "pickFile"
              ? {
                  title: fileTitle(phase.torrents),
                  hint: d.kind === "tv" ? t("pickEpisodeFileHint") : t("pickMovieFileHint"),
                  groups: phase.torrents.map((tf) => ({
                    key: tf.candidate.key,
                    label: (
                      <>
                        {titleOf(tf.candidate)} — {tf.candidate.label}
                      </>
                    ),
                    files: tf.files.map((f) => {
                      const parsed = "parsed" in f ? f.parsed : null;
                      const exact = parsed?.season === season && parsed?.episode === episode;
                      const probable = "probable" in f && f.probable;
                      return {
                        key: `${tf.candidate.key}/${f.id}`,
                        name: fileName(f),
                        meta: fileMeta(f),
                        badge: exact ? t("fileMatches") : probable ? t("fileProbable", { season: season ?? 0 }) : null,
                        onPick: (el: HTMLElement) => {
                          keepPlace(el);
                          void pickFile(tf, f, phase.added);
                        },
                      };
                    }),
                  })),
                  noFiles: t("noVideoFiles"),
                  other: { label: t("otherSources"), run: () => setPhase({ kind: "choose" }) },
                }
              : null
          }
          external={external}
          list={
            listed
              ? {
                  heading: tt("yourServers"),
                  copies: candidates.map((c, i) => {
                    const isCurrent = active ? sameCopy(active.candidate, c) : sameCopy(current, c);
                    const playing = Boolean(isCurrent && active);
                    return {
                      key: c.key,
                      kind: c.provider,
                      title: titleOf(c),
                      meta: copyText.meta(c.server, d.title),
                      badge: playing ? "playing" : failed.current.has(c.key) ? "failed" : i === 0 && candidates.length > 1 && !active ? "first" : null,
                      server: c.server,
                      playing,
                      onWatch: (el: HTMLElement) => {
                        if (playing) return backToPlayer();
                        keepPlace(el);
                        choose(c);
                      },
                    };
                  }),
                  all: avail.data?.servers ?? [],
                  managePath: signedIn && !isKids ? `${titleHref(d.kind, d.tmdbId, d.title)}?tab=watch` : null,
                  empty:
                    phase.kind !== "choose" || candidates.length > 0 || !signedIn
                      ? null
                      : ws.kind === "error"
                        ? { kind: "error", title: tt("statusError"), retry: () => void avail.refetch().then(() => setPhase({ kind: "loading" })), retrying: avail.isFetching }
                        : finderShown
                          ? { kind: "line", text: t("noCopiesYet") }
                          : {
                              kind: "none",
                              title: t("noSources"),
                              text: whyNothing,
                              action:
                                !isKids && (ws.kind === "noServers" || ws.kind === "unreachable") ? { label: ws.kind === "noServers" ? tt("connectServer") : tt("checkConnection"), href: "/settings/connections" } : null,
                            },
                }
              : null
          }
          finder={finderOn ? { ...finderProps, hidden: phase.kind === "preparing" } : null}
        />
      </>
    );
  }

  // A launch that failed or needs another app stays on the player's stage (11.1), wherever it was started; the sources
  // screen lies under it with its search, filters and place, for "Another source".
  const onStage = phase.kind === "error" || phase.kind === "external";
  const errorActions = (p: Extract<Phase, { kind: "error" }>, primaryRetry: boolean) => (
    <>
      {primaryRetry && p.retry && (
        <Button icon={RefreshCw} onClick={p.retry}>
          {tc("retry")}
        </Button>
      )}
      {p.gone && (
        <Button variant={p.retry ? "secondary" : "primary"} icon={Link2Off} loading={forget.pending} onClick={() => void forget.run(p.gone!)}>
          {t("forgetCopy")}
        </Button>
      )}
      {p.auth && (
        <Link href="/settings/connections" className={buttonClass("secondary")}>
          <Settings2 aria-hidden />
          {tt("checkConnection")}
        </Link>
      )}
      {alternatives && (
        <Button variant="secondary" onClick={anotherSource}>
          {t("anotherSource")}
        </Button>
      )}
      {active && (
        <Button variant="secondary" icon={Play} onClick={backToPlayer}>
          {t("backToWatching")}
        </Button>
      )}
      {/* The source that played before this one is still there to go back to, at the same position. */}
      {!active && lastGood.current && lastGood.current.candidate.key !== p.candidate?.key && (
        <Button variant="secondary" onClick={() => choose(lastGood.current!.candidate, lastGood.current!.voice)}>
          {t("backToSource", { source: versionOf(lastGood.current.candidate) })}
        </Button>
      )}
      {p.candidate && p.prepared?.externalUrl && (
        <Button variant="secondary" icon={ExternalLink} onClick={() => setPhase({ kind: "external", candidate: p.candidate!, prepared: p.prepared!, reason: reasonText(p.prepared!.methodNote) })}>
          {t("openExternal")}
        </Button>
      )}
    </>
  );
  const stage = onStage ? (
    <StartStage title={d.title} subtitle={subtitle} backLabel={t("backToTitle", { title: d.title })} onBack={toTitle}>
      {phase.kind === "error" && (
        <section id="prep-error" aria-label={t("errorTitle")} className="w-full max-w-120">
          <ErrorState
            title={t(phase.gone ? "errorGoneTitle" : "errorTitle")}
            note={phase.message}
            details={null}
            headingLevel={2}
            className="py-0 md:py-0"
            action={<div className="flex flex-wrap items-center justify-center gap-3">{errorActions(phase, true)}</div>}
          />
          <p className="mt-4 break-words text-body-s text-text-3">{phase.label}</p>
        </section>
      )}
      {phase.kind === "external" && (
        <div className="flex w-full max-w-xl flex-col gap-4 text-start">
          {external}
          {alternatives && (
            <Button variant="secondary" className="self-center" onClick={anotherSource}>
              {t("anotherSource")}
            </Button>
          )}
        </div>
      )}
    </StartStage>
  ) : null;

  return (
    <>
      {player}
      {stage}
      {/* The sources screen is a stage (3.5, SRC-02): dark roles in either theme; its lists and dialogs open inside it.
          Kept under the player's stage (its search, filters and place stay for "Another source"). */}
      <main ref={setStageEl} hidden={onStage || launching} className="stage min-h-dvh bg-stage text-text-1">
        <PortalContainerContext.Provider value={stageEl}>
          {/* Immersive (9): "←" and the title, no poster circle (SRC-13). Opened from the player, the way back is to it. */}
          <header className="sticky top-0 z-sticky border-b border-line bg-stage pt-[env(safe-area-inset-top)]">
            {/* The tool width, centred, as the list under it (owner, 2026-10-25: nothing left against the start edge). */}
            <div className="page-x mx-auto flex w-full max-w-tool items-center gap-3 py-3">
              <IconButton
                icon={ArrowLeft}
                label={active ? t("backToWatching") : t("backToTitle", { title: d.title })}
                variant="secondary"
                onClick={active ? backToPlayer : toTitle}
              />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-h3">{d.title}</h1>
                <p className="truncate text-body-s text-text-2">{[t("sourcesHeading"), episodeLabel].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          </header>
          <div className="page-x mx-auto flex w-full max-w-tool flex-col gap-10 pt-6 pb-16 md:pt-8">
            {phase.kind === "loading" && (
              <div className="flex flex-col gap-3" role="status" aria-label={t("loading")}>
                <Skeleton shape="md" className="h-22 w-full" />
                <Skeleton shape="md" className="h-22 w-full" />
              </div>
            )}

            {phase.kind === "pickFile" && (
              <SourceSection
                id="pick-file-h"
                title={fileTitle(phase.torrents)}
              >
                <p className="text-body-s text-text-2">{d.kind === "tv" ? t("pickEpisodeFileHint") : t("pickMovieFileHint")}</p>
                {phase.torrents.map((tf) => (
                  <div key={tf.candidate.key} className="flex flex-col gap-2">
                    <p className="break-words text-body-s font-semibold text-text-2">
                      {titleOf(tf.candidate)} — {tf.candidate.label}
                    </p>
                    {tf.files.length === 0 ? (
                      <p className="text-body-s text-text-2">{t("noVideoFiles")}</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {tf.files.map((f) => {
                          const parsed = "parsed" in f ? f.parsed : null;
                          const exact = parsed?.season === season && parsed?.episode === episode;
                          const probable = "probable" in f && f.probable;
                          return (
                            <li key={f.id}>
                              <SourceRow
                                selected={exact || probable}
                                icon={<FileVideo />}
                                badges={exact || probable ? <AccentBadge>{exact ? t("fileMatches") : t("fileProbable", { season: season ?? 0 })}</AccentBadge> : undefined}
                                title={<span className="break-all">{fileName(f)}</span>}
                                meta={[
                                  parsed ? (parsed.season === null ? t("fileEpisodeOnly", { episode: parsed.episode }) : t("episodeLabel", { season: parsed.season, episode: parsed.episode })) : null,
                                  formatSize(f.length, locale),
                                  f.path.includes("/") ? f.path.split("/").slice(0, -1).join("/") : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                                action={
                                  <Button
                                    variant="secondary"
                                    onClick={(e) => {
                                      keepPlace(e.currentTarget);
                                      void pickFile(tf, f, phase.added);
                                    }}
                                  >
                                    <Play aria-hidden className="fill-current" />
                                    {tt("tsWatch")}
                                  </Button>
                                }
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
                <Button className="self-start" variant="secondary" onClick={() => setPhase({ kind: "choose" })}>
                  {t("otherSources")}
                </Button>
              </SourceSection>
            )}

            {(phase.kind === "choose" || phase.kind === "error" || phase.kind === "external") && (
              // The copies as the title's "Where to watch" says them (CopyChoice, sources-screen session): the one to watch
              // as a card, the rest under it; a guest, no servers, a kids profile, a failure — the same card. A series'
              // episode is changed here too.
              <div id="sources" className="flex scroll-mt-24 flex-col gap-8">
                {d.kind === "tv" && season !== null && episode !== null && (
                  <EpisodePick details={d} season={season} episode={episode} href={(s, e) => `${epHref(s, e)}&pick=1`} />
                )}
                <CopyChoice
                  copies={candidates.map((c) => ({ key: c.key, server: c.server, playing: Boolean(active && sameCopy(active.candidate, c)), failed: failed.current.has(c.key) }))}
                  all={avail.data?.servers ?? []}
                  originalLanguage={d.originalLanguage}
                  state={ws}
                  signedIn={signedIn}
                  kids={isKids}
                  finder={finderShown}
                  next={here}
                  onWatch={(copy, el) => {
                    keepPlace(el);
                    const c = candidates.find((x) => x.key === copy.key);
                    if (c) choose(c);
                  }}
                  onContinue={backToPlayer}
                  more={
                    signedIn && !isKids
                      ? (copy, size) => (
                          <CopyActions
                            copy={copy}
                            size={size}
                            manage={copy.kind === "torrserver"}
                            onRemove={setRemoval}
                            onDetails={() => setDetails(copy)}
                          />
                        )
                      : undefined
                  }
                  error={avail.error}
                  onRetry={() => void avail.refetch().then(() => setPhase({ kind: "loading" }))}
                  retrying={avail.isFetching}
                />
              </div>
            )}

            {/* Kept (hidden) while a source picked on this screen is prepared: its results, filters and place stay for a failure. */}
            {finderOn && (
              <div hidden={phase.kind === "preparing"} id="finder" className="scroll-mt-24">
                {/* Where the focus goes once a copy was removed from the list above (CopyActions): the search for another. */}
                <span id={FIND_SOURCE_ID} tabIndex={-1} className="sr-only">
                  {t("findAnother")}
                </span>
                <TorrentFinder {...finderProps} lead={candidates.length === 0 && !active} />
              </div>
            )}
          </div>
          {removal && <CopyRemovalDialog target={removal} onClose={() => setRemoval(null)} beforeRemove={releaseTorrents} />}
          <CopyDetails copy={details} all={avail.data?.servers ?? []} originalLanguage={d.originalLanguage} onClose={() => setDetails(null)} />
        </PortalContainerContext.Provider>
      </main>
    </>
  );
}

/**
 * A launch that failed or needs another app (design-system 11.1): the launch's own black stage, "←" to the title, the
 * title and episode where the player shows them. So "Watch" leads to the picture or to why not, never to a screen of
 * sources nobody asked for.
 */
function StartStage({ title, subtitle, backLabel, onBack, children }: { title: string; subtitle: string | null; backLabel: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="stage fixed inset-0 z-player overflow-y-auto bg-stage text-text-1">
      <div className="fixed start-4 top-[max(1rem,env(safe-area-inset-top))] z-10 md:start-8 md:top-8">
        <IconButton icon={ArrowLeft} label={backLabel} variant="stage" size="lg" onClick={onBack} className="[&_svg]:rtl:-scale-x-100" />
      </div>
      <main className="relative flex min-h-dvh flex-col px-4 pt-24 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-10 md:pb-8">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">{children}</div>
        <div className="min-w-0">
          <h1 className="truncate text-title text-text-1 md:text-h3">{title}</h1>
          {subtitle && <p className="truncate text-body-s font-medium text-text-2 md:text-body">{subtitle}</p>}
        </div>
      </main>
    </div>
  );
}
