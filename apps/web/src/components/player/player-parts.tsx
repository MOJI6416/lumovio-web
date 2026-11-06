"use client";

import type { Availability, SeasonDetails } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { useReleaseText } from "@/components/sources/release-text";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
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
 * What the site's player menus (PlayerMenus) and the TV's panels (PlayerPanels) share: the layers' names, a series'
 * episodes and a title's copies as the player gets them, tracks and formats in words, the timing's numbers, playback
 * info, the episode list and the keys.
 */

/** The player's layers (design-system 11.1): a panel on the right on a PC and a TV, a sheet on a phone; keys in a dialog. */
export type PlayerPanel = "none" | "tracks" | "settings" | "info" | "episodes" | "source" | "help";

/** Every season of a series, for the in-player episode list (PLR-11: not only the current season). */
export interface EpisodesInfo {
  titleId: string;
  tmdbId: number;
  seasons: { seasonNumber: number; name: string; episodeCount: number }[];
  season: number;
  episode: number;
  /** The address of an episode's player (replaces this one). */
  href: (season: number, episode: number) => string;
}

/** This title's copies for the "Source" panel, and the search for another release (PLR-03). */
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
    const words = [lang, kind ?? f.title].filter(Boolean).join(" · ");
    return words || (n ? t("trackNumber", { n }) : t("trackUnnamed"));
  };
}

/** "Stats for nerds" (PLR-06): what plays, how the stream reaches this device and why, in words; refreshed every second. */
export function InfoBody({ prepared, info, bufferedAhead, dense }: { prepared: PreparedPlayback; info: { version: string; server: string }; bufferedAhead: number; dense?: boolean }) {
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
  // `dense`: the site's settings menu, a fact a line (name, value); the TV's panel one under the other.
  return (
    <dl className={dense ? "grid grid-cols-[auto_1fr] gap-x-4 gap-y-2" : "flex flex-col gap-4"} aria-live="off">
      {rows.map(([k, v]) => (
        <div key={k} className={dense ? "contents" : undefined}>
          <dt className="text-body-s text-text-2">{k}</dt>
          <dd className={dense ? "break-words text-body-s text-text-1 tabular-nums" : "mt-0.5 break-words text-body text-text-1 tabular-nums"}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The episodes of any season (PLR-11), the one playing marked; an episode opens in this player. Spoilers (8.12): the
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
        <div className="flex flex-col items-start gap-2">
          <p className="text-body-s text-text-2">{t("episodesFailed")}</p>
          <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
            {tc("retry")}
          </Button>
        </div>
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

/** Only what works for this video, plus the ways without keys (PLR-13). */
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
