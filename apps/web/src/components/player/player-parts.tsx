"use client";

import type { Availability, SeasonDetails } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReleaseText } from "@/components/sources/release-text";
import { Tag } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { ErrorState } from "@/components/ui/ErrorState";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLibraryState } from "@/hooks/useLibraryState";
import { useSpoilerPrefs } from "@/hooks/useSpoilers";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/images";
import { audioTrackFacts } from "@/lib/media/explain";
import type { SubtitleFormat } from "@/lib/media/subs/engine";
import { OFFSET_STEP } from "@/lib/media/subs/view";
import type { PreparedPlayback } from "@/lib/media/types";
import { episodesOpen } from "@/lib/spoilers";
import { useWhy } from "./use-why";

/*
 * What the site's player menus (PlayerMenus) and the TV's (PlayerPanels) share: the layers' names, the menu's surface
 * over its button, a series' episodes and a title's copies as the player gets them, tracks and formats in words, the
 * timing's numbers, playback info, the episode list and the keys.
 */

/** The player's layers: a menu over its button on a PC and a TV, a sheet on a phone; keys in a dialog. */
export type PlayerPanel = "none" | "tracks" | "settings" | "info" | "episodes" | "source" | "help";

/** Every season of a series, for the in-player episode list (not only the current season). */
export interface EpisodesInfo {
  titleId: string;
  tmdbId: number;
  seasons: { seasonNumber: number; name: string; episodeCount: number }[];
  season: number;
  episode: number;
  /** The address of an episode's player (replaces this one). */
  href: (season: number, episode: number) => string;
}

/** This title's copies for the "Source" panel, and the search for another release. */
export interface SourcesInfo {
  /** `title`: the copy's marks and words (QualityLine). */
  list: { key: string; kind: Availability["kind"]; title: ReactNode; meta: string; current: boolean; failed: boolean }[];
  /** Another copy, from this position. */
  onPick: (key: string, positionSec: number) => void;
  /** The sources screen over the paused player, with the way back to it; absent for a kids profile. */
  onSearch?: (positionSec: number) => void;
}

/** Format names under a track (technical, the same in every language). */
export const FORMAT_NAME: Record<SubtitleFormat, string> = { srt: "SRT", vtt: "WebVTT", ass: "ASS", pgs: "PGS", vobsub: "VobSub", tx3g: "MP4 Timed Text" };

/** Seconds with a sign and one decimal ("+1.5", "-0.5", "0.0"): the subtitle timing. */
export function useSignedSeconds() {
  return new Intl.NumberFormat(useLocale(), { signDisplay: "exceptZero", minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** A file's track in words: its language and translation, or its own title when that says more, or "Track 2". */
export function useTrackWords(originalLanguage: string | null) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const text = useReleaseText();
  return (title: string | null, tag: string | null, n?: number) => {
    const f = audioTrackFacts(title, tag, originalLanguage);
    const lang = f.language ? text.cap(text.language(f.language)) : null;
    const tr = f.track;
    const kind = tr?.original ? t("trackOriginal") : tr?.voice ? (tr.studio ?? tr.credit ? `${tt(`voice_${tr.voice}`)} (${tr.studio ?? tr.credit})` : tt(`voice_${tr.voice}`)) : (tr?.studio ?? tr?.credit ?? null);
    // A studio's own cut of its track ("MVO [HDrezka Studio] 18+") says so: two tracks of one studio don't read alike.
    const adult = kind && title && /(?<![\d])18\+/.test(title) ? "18+" : null;
    const words = [lang, kind ?? f.title, adult].filter(Boolean).join(" · ");
    return words || (n ? t("trackNumber", { n }) : t("trackUnnamed"));
  };
}

/** "Stats for nerds": what plays, how the stream reaches this device and why, in words; refreshed every second. */
export function InfoBody({ prepared, info, bufferedAhead }: { prepared: PreparedPlayback; info: { version: string; server: string }; bufferedAhead: number }) {
  const t = useTranslations("player");
  const one = new Intl.NumberFormat(useLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const [live, setLive] = useState<{ w: number; h: number; dropped: number | null; total: number | null }>({ w: 0, h: 0, dropped: null, total: null });
  useEffect(() => {
    const tick = () => {
      const v = document.querySelector<HTMLVideoElement>("[data-player] video");
      if (!v) return;
      const q = typeof v.getVideoPlaybackQuality === "function" ? v.getVideoPlaybackQuality() : null;
      setLive({ w: v.videoWidth, h: v.videoHeight, dropped: q?.droppedVideoFrames ?? null, total: q?.totalVideoFrames ?? null });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  const i = prepared.info ?? {};
  const method = t(prepared.type === "remux" ? "methodRebuilt" : prepared.method === "direct" ? "methodDirect" : prepared.method === "remux" ? "methodServerRemux" : prepared.method === "transcode" ? "methodTranscode" : "methodExternal");
  const why = useWhy()(prepared.methodNote);
  const rows: [string, string][] = [
    [t("infoVersion"), info.version],
    [t("infoServer"), info.server],
    [t("infoMethod"), [method, ...why].join(". ")],
    [t("infoContainer"), [i.container?.toUpperCase(), prepared.type === "hls" ? "HLS" : null].filter(Boolean).join(" · ") || "—"],
    [t("infoCodecs"), [i.videoCodec, i.audioCodec].filter(Boolean).join(" / ").toUpperCase() || "—"],
    [t("infoResolution"), live.w ? `${live.w}×${live.h}${i.width && i.width !== live.w ? ` (${t("infoSourceRes", { res: `${i.width}×${i.height}` })})` : ""}` : "—"],
    [t("infoBitrate"), i.bitrate ? t("bitrate", { value: one.format(i.bitrate / 1e6) }) : "—"],
    [t("infoBuffer"), t("seconds", { value: one.format(bufferedAhead) })],
    [t("infoDropped"), live.dropped !== null && live.total ? `${live.dropped} / ${live.total}` : "—"],
  ];
  // A fact a line (name, value), short enough for a menu over the picture — the site's settings and the TV's menu.
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2" aria-live="off">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-body-s text-text-2">{k}</dt>
          <dd className="break-words text-body-s text-text-1 tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The episodes of any season, the one playing marked; an episode opens in this player. Spoilers: the
 * stills (and names, if the profile hides them) of unwatched episodes are blurred, with no button — pressing the row
 * plays it; the one playing is open.
 */
export function EpisodesBody({ episodes: e, onPick }: { episodes: EpisodesInfo; onPick: () => void }) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [season, setSeason] = useState(e.season);
  const prefs = useSpoilerPrefs();
  const open = episodesOpen(useLibraryState(e.titleId).data?.watchedEpisodes);
  // The same query as the title page's season browser, so it's usually already cached.
  const q = useQuery({
    queryKey: ["season", e.tmdbId, season, locale],
    queryFn: () => api<SeasonDetails>(`/api/catalog/tv/${e.tmdbId}/season/${season}`),
    staleTime: 30 * 60_000,
  });
  return (
    <div className="flex flex-col gap-4">
      {e.seasons.length > 1 && (
        <Select
          value={String(season)}
          onValueChange={(v) => setSeason(Number(v))}
          options={e.seasons.map((s) => ({ value: String(s.seasonNumber), label: s.seasonNumber === 0 ? s.name : t("seasonOption", { season: s.seasonNumber, count: s.episodeCount }) }))}
          aria-label={t("seasonPick")}
        />
      )}
      {q.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton shape="sm" className="h-18 w-full" />
          <Skeleton shape="sm" className="h-18 w-full" />
          <Skeleton shape="sm" className="h-18 w-full" />
        </div>
      ) : q.isError ? (
        <ErrorState variant="inline" error={q.error} title={t("episodesFailed")} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      ) : (
        <ol className="-mx-2 flex flex-col gap-1">
          {q.data.episodes.map((ep) => {
            const current = season === e.season && ep.episodeNumber === e.episode;
            const still = tmdbImage(ep.stillPath, "w300");
            const closed = !current && !open(season, ep.episodeNumber);
            return (
              <li key={ep.episodeNumber}>
                <Link
                  href={e.href(season, ep.episodeNumber)}
                  replace
                  aria-current={current ? "true" : undefined}
                  onClick={onPick}
                  className="flex gap-3 rounded-sm p-2 transition-colors duration-fast ease-fast hover:bg-surface-2 aria-[current=true]:bg-surface-3"
                >
                  <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xs bg-surface-2">
                    {still && <img src={still} alt="" loading="lazy" className={cn("size-full object-cover", closed && prefs.stills && "scale-110 blur-lg")} />}
                    {current && <span className="absolute inset-x-0 bottom-0 h-1 bg-progress" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-body-s text-text-2">
                      {[t("episodeShort", { episode: ep.episodeNumber }), ep.runtime ? tc("minutes", { count: ep.runtime }) : null].filter(Boolean).join(" · ")}
                    </span>
                    <span aria-hidden={(closed && prefs.names) || undefined} className={cn("line-clamp-2 text-title text-text-1", closed && prefs.names && "select-none blur-sm")}>
                      {ep.name}
                    </span>
                    {current && <Tag className="mt-1">{t("nowPlaying")}</Tag>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Only what works for this video, plus the ways without keys. */
export function ShortcutRows({ subtitles, next, segments }: { subtitles: boolean; next: boolean; segments: boolean }) {
  const t = useTranslations("player");
  const ts = useTranslations("subtitles");
  const one = new Intl.NumberFormat(useLocale(), { maximumFractionDigits: 1 });
  const rows: [string, string][] = [
    [t("keySpace"), t("keyPlayPause")],
    ["← →  J L", t("keySeek")],
    ["↑ ↓", t("keyVolume")],
    ["M", t("keyMute")],
    ["F", t("keyFullscreen")],
    ...(subtitles ? [["C", t("keySubtitles")] as [string, string], ["G H", ts("keyTiming", { step: one.format(OFFSET_STEP) })] as [string, string]] : []),
    ...(segments ? [["S", t("keySkip")] as [string, string]] : []),
    ...(next ? [["N", t("nextEpisode")] as [string, string]] : []),
    ["0–9", t("keyJump")],
    ["I", t("playbackInfo")],
    ["Esc", t("keyEscape")],
    [t("keyDoubleClick"), t("keyFullscreen")],
    [t("keyDoubleTap"), t("keyDoubleTapText")],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-body">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>
            <span className="inline-block whitespace-nowrap rounded-xs border border-line-2 px-2 py-0.5 text-body-s font-semibold tabular-nums">{k}</span>
          </dt>
          <dd className="text-text-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]';

/**
 * The focus on the chosen row of a menu (a checked row or radio), else its first control, else the menu itself (a list
 * only read, as the playback info): on open, and as a level replaces the list.
 */
export const focusChoice = (el: HTMLElement | null) => (el?.querySelector<HTMLElement>('[aria-checked="true"], input:checked') ?? el?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus({ preventScroll: true });

/**
 * A menu of the player over the picture, the site's (PlayerMenus) and the TV's (PlayerPanels): above its button,
 * aligned to the button's end, as tall as the room above it — no veil, nothing moves aside: the film stays in view and
 * plays on. The chosen row (else the first control) takes the focus, which goes back to the button when the surface
 * closes; a row the keys or a remote move to is scrolled into view. `over="bar"` (a TV): over the whole block of
 * controls, the timeline in view, rather than over the button alone.
 */
export function Surface({ anchor, label, onClose, className, over = "button", children }: { anchor: RefObject<HTMLButtonElement | null>; label: string; onClose: () => void; className: string; over?: "button" | "bar"; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [box, setBox] = useState<{ end: number; bottom: number; max: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current;
      const root = ref.current?.offsetParent;
      if (!a || !(root instanceof HTMLElement)) return;
      const r = a.getBoundingClientRect();
      const c = root.getBoundingClientRect();
      const rtl = getComputedStyle(root).direction === "rtl";
      const top = over === "bar" ? (a.closest("[data-player-bar]")?.getBoundingClientRect().top ?? r.top) : r.top;
      // No taller than 70 % of the player: the picture stays the larger part of the screen.
      setBox({ end: Math.max(16, rtl ? r.left - c.left : c.right - r.right), bottom: c.bottom - top + 8, max: Math.min(top - c.top - 24, c.height * 0.7) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor, over]);
  // Focused once it is placed (hidden until then, it couldn't take the focus).
  const placed = box !== null;
  useEffect(() => {
    if (placed) focusChoice(ref.current);
  }, [placed]);
  useEffect(() => {
    const el = ref.current;
    const a = anchor.current;
    // A press outside closes it; the button itself toggles it.
    const down = (e: PointerEvent) => {
      const target = e.target as Node;
      // A list opened from inside (the season's Select) is portalled out of it, and isn't outside.
      if (target instanceof Element && target.closest('[role="listbox"], [data-radix-popper-content-wrapper]')) return;
      if (!el?.contains(target) && !a?.contains(target)) closeRef.current();
    };
    document.addEventListener("pointerdown", down, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      const now = document.activeElement;
      if (a?.isConnected && (!now || now === document.body || el?.contains(now))) a.focus({ preventScroll: true });
    };
  }, [anchor]);
  // Up and down move between the rows of one list (the lists are menus: arrows don't choose, Enter and Space do).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const list = (e.target as HTMLElement).closest('[role="menu"]');
    if (!list) return;
    const rows = [...list.querySelectorAll<HTMLElement>("[data-menu-row]:not([disabled])")];
    const i = rows.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    rows[(i + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length]?.focus();
  };
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      data-player-menu
      onKeyDown={onKeyDown}
      // A TV's remote focuses without scrolling (tvui/nav): the row it lands on is brought into view here.
      onFocus={(e) => (e.target as HTMLElement).scrollIntoView?.({ block: "nearest" })}
      style={box ? { insetInlineEnd: box.end, bottom: box.bottom, maxHeight: box.max } : { visibility: "hidden" }}
      className={cn(
        "pointer-events-auto absolute z-10 max-w-[calc(100%-2rem)] animate-fade-up overflow-y-auto overscroll-contain material rounded-lg p-2 text-text-1 outline-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
