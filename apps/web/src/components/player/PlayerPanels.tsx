"use client";

import type { Availability, SeasonDetails, SubtitleStyle } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { usePlayer } from "@videojs/react/video";
import { Info, Keyboard, Play, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { ServerMark } from "@/components/connections/ServerMark";
import { useReleaseText } from "@/components/sources/release-text";
import { SourceRow } from "@/components/sources/SourceRow";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Checkbox";
import { cn } from "@/components/ui/cn";
import { Dialog, SidePanel } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLibraryState } from "@/hooks/useLibraryState";
import { useSpoilerPrefs } from "@/hooks/useSpoilers";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/images";
import { episodesOpen } from "@/lib/spoilers";
import { audioTrackFacts } from "@/lib/media/explain";
import type { SubtitleFormat } from "@/lib/media/subs/engine";
import { OFFSET_STEP, stepOffset } from "@/lib/media/subs/view";
import type { PreparedPlayback } from "@/lib/media/types";
import type { SubtitleLook, SubtitleMeta } from "./LumovioPlayer";
import { useWhy } from "./use-why";

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
  list: { key: string; kind: Availability["kind"]; title: string; meta: string; current: boolean; failed: boolean }[];
  /** Another copy, from this position. */
  onPick: (key: string, positionSec: number) => void;
  /** The sources screen over the paused player, with the way back to it; absent for a kids profile. */
  onSearch?: (positionSec: number) => void;
}

/**
 * The player's panels, each opened by its button in the bar and closed by Escape, Back on a TV, the close button or a
 * tap outside — with the focus trapped inside and given back to that button (PLR-11): audio and subtitles (always
 * there, tracks in words, PLR-07), quality and speed, playback info (how the stream reaches the screen, PLR-06), the
 * episodes of every season, the source (other copies; the search). Keyboard shortcuts — only what this video has.
 */
export function PlayerPanels({
  panel,
  onPanel,
  prepared,
  onAudioChange,
  currentTime,
  episodes,
  sources,
  info,
  bufferedAhead,
  originalLanguage,
  hasNext,
  hasSegments,
  subtitleMeta,
  look,
}: {
  panel: PlayerPanel;
  onPanel: (p: PlayerPanel) => void;
  prepared: PreparedPlayback;
  onAudioChange?: (index: number, positionSec: number) => void;
  currentTime: number;
  episodes: EpisodesInfo | null;
  sources: SourcesInfo | null;
  info: { version: string; server: string };
  bufferedAhead: number;
  originalLanguage: string | null;
  hasNext: boolean;
  hasSegments: boolean;
  subtitleMeta?: SubtitleMeta;
  look?: SubtitleLook;
}) {
  const t = useTranslations("player");
  const close = (o: boolean) => !o && onPanel("none");
  // A TV remote's OK (Enter) chooses in the lists: ui/RadioGroup does it (C19).
  const back = (
    <Button variant="secondary" onClick={() => onPanel("none")} className="mt-6 w-full">
      <Play aria-hidden className="fill-current" />
      {t("backToWatching")}
    </Button>
  );
  return (
    <>
      <SidePanel open={panel === "tracks"} onOpenChange={close} title={t("audioAndSubtitles")}>
        <TracksBody prepared={prepared} onAudioChange={onAudioChange} currentTime={currentTime} originalLanguage={originalLanguage} subtitleMeta={subtitleMeta} look={look} />
        {back}
      </SidePanel>
      <SidePanel open={panel === "settings"} onOpenChange={close} title={t("qualityAndSpeed")}>
        <SettingsBody canSwitch={Boolean(sources)} onInfo={() => onPanel("info")} onHelp={() => onPanel("help")} />
        {back}
      </SidePanel>
      <SidePanel open={panel === "info"} onOpenChange={close} title={t("playbackInfo")}>
        {panel === "info" && <InfoBody prepared={prepared} info={info} bufferedAhead={bufferedAhead} />}
        {back}
      </SidePanel>
      {episodes && (
        <SidePanel open={panel === "episodes"} onOpenChange={close} title={t("episodes")}>
          {panel === "episodes" && <EpisodesBody episodes={episodes} onPick={() => onPanel("none")} />}
        </SidePanel>
      )}
      {sources && (
        <SidePanel open={panel === "source"} onOpenChange={close} title={t("source")} description={t("sourcePanelText")}>
          <SourceBody
            sources={sources}
            onPick={(key) => {
              onPanel("none");
              sources.onPick(key, currentTime);
            }}
            onSearch={
              sources.onSearch &&
              (() => {
                onPanel("none");
                sources.onSearch?.(currentTime);
              })
            }
          />
          {back}
        </SidePanel>
      )}
      <Dialog open={panel === "help"} onOpenChange={close} title={t("shortcuts")} size="sm">
        <Shortcuts subtitles={prepared.subtitles.length > 0 || Boolean(subtitleMeta?.size)} next={hasNext} segments={hasSegments} />
      </Dialog>
    </>
  );
}

/** A note in a panel: what the file has, or why something can't be chosen here. */
function Note({ children }: { children: ReactNode }) {
  return <p className="text-body-s text-text-2">{children}</p>;
}

/**
 * Audio and subtitles (PLR-07): every track in words — "Russian · dubbed (Pifagor)", not "Dub (Пифагор) AAC" — with its
 * format underneath, the one playing checked; one track or none is said so rather than the button disappearing. With
 * subtitles, their size (the profile's) and timing (this title's) under the list.
 */
function TracksBody({
  prepared,
  onAudioChange,
  currentTime,
  originalLanguage,
  subtitleMeta,
  look,
}: {
  prepared: PreparedPlayback;
  onAudioChange?: (index: number, positionSec: number) => void;
  currentTime: number;
  originalLanguage: string | null;
  subtitleMeta?: SubtitleMeta;
  look?: SubtitleLook;
}) {
  const t = useTranslations("player");
  const store = usePlayer();
  const audioTracks = usePlayer((s) => s.audioTrackList);
  const textTracks = usePlayer((s) => s.textTrackList);
  const subtitlesShowing = usePlayer((s) => s.subtitlesShowing);
  const words = useTrackWords(originalLanguage);
  // A subtitle track in a language is that language's subtitles, never "the original" of the audio.
  const subWords = useTrackWords(null);
  const subtitleTracks = textTracks.filter((tr) => tr.kind === "subtitles" || tr.kind === "captions");
  // HLS gives its own audio list; a file gives the server's (switched by preparing it again, or in place when rebuilt).
  const hls = audioTracks.length > 1;
  const audio = hls
    ? audioTracks.map((a) => ({ value: a.id, label: words(a.label || null, a.language || null), description: undefined as string | undefined, checked: a.enabled }))
    : prepared.audio.map((a, i) => ({ value: String(a.index), label: words(a.label, a.lang, i + 1), description: a.codec?.toUpperCase(), checked: a.isDefault }));
  const canSwitch = hls || Boolean(onAudioChange);
  const shownSub = subtitleTracks.find((tr) => tr.mode === "showing");
  return (
    <div className="flex flex-col gap-6">
      {audio.length === 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-body-s font-semibold text-text-1">{t("audio")}</h3>
          <Note>{t("audioUnknown")}</Note>
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          <RadioGroup
            legend={t("audio")}
            value={audio.find((a) => a.checked)?.value ?? null}
            onValueChange={(v) => {
              if (hls) store.selectAudioTrack(v);
              else onAudioChange?.(Number(v), currentTime);
            }}
            options={audio.map((a) => ({ value: a.value, label: a.label, description: a.description, disabled: !canSwitch && !a.checked }))}
          />
          {audio.length === 1 ? <Note>{t("audioOne")}</Note> : !canSwitch && <Note>{t("audioNoSwitch")}</Note>}
        </div>
      )}
      {subtitleTracks.length === 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-body-s font-semibold text-text-1">{t("subtitles")}</h3>
          <Note>{t("subtitlesNone")}</Note>
        </section>
      ) : (
        <RadioGroup
          legend={t("subtitles")}
          value={subtitlesShowing && shownSub ? shownSub.id : "off"}
          onValueChange={(v) => store.selectSubtitlesTrack(v === "off" ? null : v)}
          options={[
            { value: "off", label: t("subtitlesOff") },
            ...subtitleTracks.map((tr, i) => {
              // The file's own tracks and the torrent's files (PLR-14): forced ones said so, the format underneath.
              const m = subtitleMeta?.get(tr.id);
              const words = subWords(tr.label || null, tr.language || null, i + 1);
              return {
                value: tr.id,
                // "Forced" said once: not again after a track already named "Надписи".
                label: m?.forced && !words.toLowerCase().includes(t("subtitlesForced").toLowerCase()) ? `${words} · ${t("subtitlesForced")}` : words,
                description: m ? [FORMAT_NAME[m.format], m.file ? t("subtitlesFile") : null].filter(Boolean).join(" · ") : undefined,
              };
            }),
          ]}
        />
      )}
      {subtitleTracks.length > 0 && look && <SubtitleLookBody look={look} />}
    </div>
  );
}

/** Format names under a track (technical, the same in every language). */
const FORMAT_NAME: Record<SubtitleFormat, string> = { srt: "SRT", vtt: "WebVTT", ass: "ASS", pgs: "PGS", vobsub: "VobSub", tx3g: "MP4 Timed Text" };

/** Seconds with a sign and one decimal ("+1.5", "-0.5", "0.0"): the subtitle timing. */
export function useSignedSeconds() {
  return new Intl.NumberFormat(useLocale(), { signDisplay: "exceptZero", minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * The subtitles' size (saved to the profile; the rest of their look is in Settings → Profile) and their timing for this
 * title: "Earlier" when they come after the speech, "Later" when before, half a second a press (G / H on a keyboard).
 */
function SubtitleLookBody({ look }: { look: SubtitleLook }) {
  const t = useTranslations("player");
  const ts = useTranslations("subtitles");
  const signed = useSignedSeconds();
  const one = new Intl.NumberFormat(useLocale(), { maximumFractionDigits: 1 });
  const timing = useId();
  const later = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div className="flex flex-col gap-2">
        <RadioGroup<SubtitleStyle["size"]>
          legend={ts("sizePlayer")}
          value={look.style.size}
          onValueChange={look.setSize}
          options={(["s", "m", "l", "xl"] as const).map((v) => ({ value: v, label: ts(`size_${v}`) }))}
        />
        <Note>{look.sizeFailed ? ts("sizeFailed") : ts("playerNote")}</Note>
      </div>
      <section aria-labelledby={timing} className="flex flex-col gap-2">
        <h3 id={timing} className="text-body-s font-semibold text-text-1">
          {ts("timing")}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => look.setOffset(stepOffset(look.offset, -OFFSET_STEP))}>
            {ts("earlier")}
          </Button>
          <output aria-live="polite" className="min-w-16 text-center text-body font-semibold text-text-1 tabular-nums">
            {t("seconds", { value: signed.format(look.offset) })}
          </output>
          <Button ref={later} variant="secondary" size="sm" onClick={() => look.setOffset(stepOffset(look.offset, OFFSET_STEP))}>
            {ts("later")}
          </Button>
          {look.offset !== 0 && (
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => {
                look.setOffset(0);
                // "Reset" goes with the offset: the focus (a TV remote's) stays in the row.
                later.current?.focus();
              }}
            >
              {ts("reset")}
            </Button>
          )}
        </div>
        <Note>{ts("timingNote", { step: one.format(OFFSET_STEP) })}</Note>
      </section>
    </>
  );
}

/** A file's track in words: its language and translation, or its own title when that says more, or "Track 2". */
function useTrackWords(originalLanguage: string | null) {
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

/** Quality and speed: the stream's real versions (one file is one quality, said so), the speed, playback info, the keys. */
function SettingsBody({ canSwitch, onInfo, onHelp }: { canSwitch: boolean; onInfo: () => void; onHelp: () => void }) {
  const t = useTranslations("player");
  const number = new Intl.NumberFormat(useLocale(), { maximumFractionDigits: 2 });
  const store = usePlayer();
  const renditions = usePlayer((s) => s.videoRenditionList);
  const active = usePlayer((s) => s.activeVideoRendition);
  const rate = usePlayer((s) => s.playbackRate);
  const [height, setHeight] = useState(0);
  useEffect(() => setHeight(document.querySelector<HTMLVideoElement>("[data-player] video")?.videoHeight ?? 0), []);
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-6">
      {renditions.length > 1 ? (
        <RadioGroup
          legend={t("quality")}
          value={renditions.find((r) => r.selected)?.id ?? "auto"}
          onValueChange={(v) => store.selectVideoRendition(v)}
          options={[
            { value: "auto", label: active?.height ? t("autoWith", { height: active.height }) : t("auto") },
            ...[...renditions]
              .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
              .map((r) => ({ value: r.id, label: r.height ? `${r.height}p` : t("qualityUnnamed"), description: r.bitrate ? t("bitrate", { value: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(r.bitrate / 1e6) }) : undefined })),
          ]}
        />
      ) : (
        <section className="flex flex-col gap-2">
          <h3 className="text-body-s font-semibold text-text-1">{t("quality")}</h3>
          <Note>{height ? t("qualityOne", { height }) : t("qualityOneUnknown")}</Note>
          {canSwitch && <Note>{t("qualityOtherVersion")}</Note>}
        </section>
      )}
      <RadioGroup
        legend={t("speed")}
        value={String(rate)}
        onValueChange={(v) => store.setPlaybackRate(Number(v))}
        options={[0.75, 1, 1.25, 1.5, 2].map((r) => ({ value: String(r), label: r === 1 ? t("normal") : `${number.format(r)}×` }))}
      />
      <div className="flex flex-col gap-2">
        <Button variant="secondary" icon={Info} onClick={onInfo}>
          {t("playbackInfo")}
        </Button>
        {!coarse && (
          <Button variant="secondary" icon={Keyboard} onClick={onHelp}>
            {t("shortcuts")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** "Stats for nerds" (PLR-06): what plays, how the stream reaches this device and why, in words; refreshed every second. */
function InfoBody({ prepared, info, bufferedAhead }: { prepared: PreparedPlayback; info: { version: string; server: string }; bufferedAhead: number }) {
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
  return (
    <dl className="flex flex-col gap-4" aria-live="off">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-body-s text-text-2">{k}</dt>
          <dd className="mt-0.5 break-words text-body text-text-1 tabular-nums">{v}</dd>
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
function EpisodesBody({ episodes: e, onPick }: { episodes: EpisodesInfo; onPick: () => void }) {
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
          <Note>{t("episodesFailed")}</Note>
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

/** The title's copies (SourceRow, 7.15): the one playing marked, another from this position; the search for another release. */
function SourceBody({ sources, onPick, onSearch }: { sources: SourcesInfo; onPick: (key: string) => void; onSearch?: () => void }) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  return (
    <div className="flex flex-col gap-3">
      {sources.list.map((s) => (
        <SourceRow
          key={s.key}
          selected={s.current}
          icon={<ServerMark kind={s.kind} />}
          badges={s.current ? <Tag>{t("nowPlaying")}</Tag> : s.failed ? <Tag>{t("failedSource")}</Tag> : undefined}
          title={s.title}
          meta={s.meta}
          action={
            s.current ? undefined : (
              <Button variant="secondary" onClick={() => onPick(s.key)}>
                <Play aria-hidden className="fill-current" />
                {tt("tsWatch")}
              </Button>
            )
          }
        />
      ))}
      {onSearch && (
        <Button variant="secondary" icon={Search} onClick={onSearch} className="mt-2">
          {t("findAnother")}
        </Button>
      )}
    </div>
  );
}

/** Only what works for this video, plus the ways without keys (PLR-13). */
function Shortcuts({ subtitles, next, segments }: { subtitles: boolean; next: boolean; segments: boolean }) {
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
