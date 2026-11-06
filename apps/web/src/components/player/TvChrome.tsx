"use client";

import { Controls, TimeSlider } from "@videojs/react";
import { usePlayer } from "@videojs/react/video";
import { clsx } from "clsx";
import { ArrowLeft, Captions, FastForward, Layers, ListVideo, Pause, Play, RotateCcw, RotateCw, Settings2, SkipBack, SkipForward, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { BrandLoader } from "@/components/ui/BrandMotion";
import { Button, buttonClass } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Link } from "@/i18n/navigation";
import { formatClock, formatSize } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import type { MediaSegment, TrickplayInfo } from "@/lib/media/types";
import { titleHref } from "@/lib/slug";
import { type EndInfo, Marked } from "./EndScreen";
import { PlayerPanels } from "./PlayerPanels";
import type { PlayerProps, TorrentStats } from "./LumovioPlayer";
import { type PlayerPanel, useSignedSeconds } from "./player-parts";

const TIME_KEY = "lumovio.player.remaining";

/** What the TV's view of the player is drawn from (the state and the logic stay in LumovioPlayer's Chrome). */
export interface TvChromeProps {
  props: PlayerProps;
  showChrome: boolean;
  hit: string;
  buffering: boolean;
  bufferedAhead: number;
  torrent: TorrentStats;
  tp: TrickplayInfo | null;
  hoverTime: number | null;
  onSliderMove: (e: PointerEvent<HTMLElement>) => void;
  onSliderLeave: () => void;
  segments: MediaSegment[];
  segment: MediaSegment | undefined;
  showSkip: boolean;
  skip: () => void;
  endShown: boolean;
  startOver: "wait" | "show" | "gone";
  onStartOver: () => void;
  nextCountdown: number | null;
  onNextCancel: () => void;
  seekHint: { delta: number; at: number } | null;
  offsetHint: number | null;
  togglePlay: () => unknown;
  onPanel: (p: PlayerPanel) => void;
  onReplay: () => void;
  Thumb: (p: { tp: TrickplayInfo; time: number }) => ReactNode;
  /** The TV's panels (SidePanel at the right, the picture aside). */
  panels: Parameters<typeof PlayerPanels>[0];
}

/**
 * The player in the TV shell (tvui, TV document §6), drawn as it was before the site's redesign of 2026-11-06: "←" and
 * the title on top, a bar of play, ±10, the time (elapsed or remaining by a press) and the panels' buttons, the next
 * episode's card and the end screen. The remote's model (OK, arrows, Back, the panel at the right with the picture
 * aside) is LumovioPlayer's.
 */
export function TvChrome(v: TvChromeProps) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const ts = useTranslations("subtitles");
  const locale = useLocale();
  const signedSeconds = useSignedSeconds();
  const store = usePlayer();
  const paused = usePlayer((s) => s.paused);
  const started = usePlayer((s) => s.started);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const subtitlesShowing = usePlayer((s) => s.subtitlesShowing);
  const { props, showChrome, hit, segments, segment } = v;
  const [remaining, setRemaining] = useState(() => {
    try {
      return localStorage.getItem(TIME_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleTime = () => {
    setRemaining((r) => {
      try {
        localStorage.setItem(TIME_KEY, r ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !r;
    });
  };
  const known = duration > 0;
  const timeText = !known ? "--:--" : remaining ? `−${formatClock(Math.max(0, duration - currentTime))}` : `${formatClock(currentTime)} / ${formatClock(duration)}`;
  const tp = v.tp;
  return (
    <>
      {/* Scrims for the title and the controls, in the stage colour (3.5). */}
      <Controls.Backdrop className={clsx("pointer-events-none absolute inset-0 transition-opacity duration-slow", showChrome ? "opacity-100" : "opacity-0")}>
        <div className="absolute inset-x-0 top-0 h-1/4 bg-linear-to-b from-stage/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-stage/90 to-transparent" />
      </Controls.Backdrop>

      {v.buffering && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-3 rounded-md bg-stage/50 px-5 py-4 backdrop-blur in-data-[tv=1]:backdrop-blur-none">
            <BrandLoader size="lg" />
            <p className="text-body-s font-semibold text-text-1">{started ? t("buffering", { percent: Math.min(99, Math.round((v.bufferedAhead / 10) * 100)) }) : t("loading")}</p>
            {v.torrent && (v.torrent.peers !== null || v.torrent.speedBps !== null) && (
              <p className="text-caption text-text-2">
                {[
                  v.torrent.peers !== null ? t("torrentPeers", { count: v.torrent.peers }) : null,
                  v.torrent.speedBps !== null ? t("torrentSpeed", { speed: formatSize(v.torrent.speedBps, locale) ?? "0" }) : null,
                  v.torrent.preloadedBytes ? t("torrentLoaded", { size: formatSize(v.torrent.preloadedBytes, locale) ?? "" }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* A touch screen: back, play and forward in the middle; the bar then has no second set (PLR-12). */}
      <div className={clsx("pointer-events-none absolute inset-0 hidden items-center justify-center gap-12 transition-opacity duration-slow pointer-coarse:flex", showChrome ? "opacity-100" : "opacity-0")}>
        <IconButton icon={RotateCcw} label={t("back10")} variant="stage" size="lg" className={hit} onClick={() => void store.seek(Math.max(0, currentTime - 10))} />
        <IconButton
          icon={paused ? Play : Pause}
          label={paused ? t("play") : t("pause")}
          variant="stage"
          size="lg"
          className={clsx(hit, "size-18 [&_svg]:size-9 [&_svg]:fill-current [&>span]:size-18")}
          onClick={() => void v.togglePlay()}
        />
        <IconButton icon={RotateCw} label={t("forward10")} variant="stage" size="lg" className={hit} onClick={() => void store.seek(currentTime + 10)} />
      </div>

      <Controls.Content className={clsx("pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-slow", showChrome ? "opacity-100" : "opacity-0")}>
        <Controls.Group className={clsx(hit, "flex items-start gap-3 p-4 pt-[max(16px,env(safe-area-inset-top))] md:p-8")}>
          <IconButton icon={ArrowLeft} label={tc("back")} variant="stage" size="lg" onClick={props.onBack} className="[&_svg]:rtl:-scale-x-100" />
          <div className="min-w-0 flex-1 pt-1">
            <p className="truncate text-h3 md:text-h2">{props.title}</p>
            {props.subtitle && <p className="truncate text-body-s font-medium text-text-2 md:text-body">{props.subtitle}</p>}
          </div>
        </Controls.Group>

        <Controls.Group data-player-bar className={clsx(hit, "flex flex-col gap-2 p-4 pb-[max(16px,env(safe-area-inset-bottom))] md:px-8 md:pb-6")}>
          {props.footerNote}
          <TimeSlider.Root
            className="group/ts relative flex h-8 w-full cursor-pointer touch-none items-center rounded-full focus-visible:outline-none"
            data-nav-native
            label={t("timeline")}
            onPointerMove={v.onSliderMove}
            onPointerLeave={v.onSliderLeave}
          >
            <TimeSlider.Track className="relative h-1 w-full overflow-hidden rounded-full bg-text-1/25 transition-[height] duration-fast ease-fast group-hover/ts:h-1.5 group-focus-within/ts:h-1.5">
              <TimeSlider.Buffer className="absolute inset-y-0 start-0 w-(--media-slider-buffer) bg-text-1/35" />
              <TimeSlider.Fill className="absolute inset-y-0 start-0 w-(--media-slider-fill) bg-progress" />
            </TimeSlider.Track>
            {/* Intro / credits ranges marked on the timeline. */}
            {known &&
              segments.map((s) => (
                <span
                  key={`${s.kind}-${s.start}`}
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 bg-text-1/45"
                  style={{ insetInlineStart: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%` }}
                />
              ))}
            {/* The knob is the slider's focus stop: it shows, with the focus ring, while it has the keyboard's focus (PLR-09). */}
            <TimeSlider.Thumb className="absolute start-(--media-slider-fill) size-4 -translate-x-1/2 scale-0 rounded-full bg-text-1 transition-transform duration-fast ease-fast group-hover/ts:scale-100 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus focus-visible:shadow-(--focus-halo) rtl:translate-x-1/2" />
            <TimeSlider.Preview className="pointer-events-none absolute bottom-9 start-(--media-slider-pointer) flex -translate-x-1/2 flex-col items-center opacity-0 group-hover/ts:opacity-100 rtl:translate-x-1/2">
              {tp && v.hoverTime !== null && <v.Thumb tp={tp} time={v.hoverTime} />}
              <span className="rounded-xs bg-stage/85 px-2 py-1 text-caption font-bold tabular-nums">
                <TimeSlider.Value type="pointer" />
              </span>
            </TimeSlider.Preview>
          </TimeSlider.Root>

          <div className="flex items-center gap-1 md:gap-2">
            <span className="contents pointer-coarse:hidden">
              <Control icon={paused ? Play : Pause} filled label={paused ? t("play") : t("pause")} onClick={v.togglePlay} tvPlay />
              <Control icon={RotateCcw} label={t("back10")} onClick={() => store.seek(Math.max(0, currentTime - 10))} />
              <Control icon={RotateCw} label={t("forward10")} onClick={() => store.seek(currentTime + 10)} />
            </span>
            {/* One time, elapsed or remaining by a press (PLR-12). */}
            <Button variant="tertiary" size="sm" onClick={toggleTime} aria-label={remaining ? t("showElapsed") : t("showRemaining")} className="ms-1">
              <span className="tabular-nums">{timeText}</span>
            </Button>

            <div className="ms-auto flex items-center gap-1 md:gap-2">
              {props.next && <Control icon={SkipForward} label={t("nextEpisode")} onClick={props.next.go} />}
              {props.episodes && <Control icon={ListVideo} label={t("episodes")} onClick={() => v.onPanel("episodes")} />}
              {/* Always there, with one track or none too: the panel says what the file has (PLR-07). */}
              <span className="relative inline-flex">
                <Control icon={Captions} label={t("audioAndSubtitles")} onClick={() => v.onPanel("tracks")} />
                {subtitlesShowing && <span aria-hidden className="pointer-events-none absolute end-2 top-2 size-2 rounded-full bg-accent" />}
              </span>
              <Control icon={Settings2} label={t("qualityAndSpeed")} onClick={() => v.onPanel("settings")} />
              {props.sources && <Control icon={Layers} label={t("source")} onClick={() => v.onPanel("source")} />}
            </div>
          </div>
        </Controls.Group>
      </Controls.Content>

      {v.seekHint && (
        // The remote's seek, said where the eye is (TV document §6: clear feedback of seeking).
        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/2 grid -translate-y-1/2 place-items-center">
          <span className="flex items-center gap-3 rounded-full bg-stage/80 px-6 py-3 text-h2 font-bold text-text-1 tabular-nums">
            {v.seekHint.delta < 0 ? <RotateCcw aria-hidden className="size-8" /> : <RotateCw aria-hidden className="size-8" />}
            {t(v.seekHint.delta < 0 ? "seekBack" : "seekForward", { seconds: Math.abs(v.seekHint.delta) })}
          </span>
        </div>
      )}

      {v.offsetHint !== null && !v.seekHint && (
        // G / H: where the subtitles are now, in the same place as the remote's seek.
        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/2 grid -translate-y-1/2 place-items-center">
          <span className="flex items-center gap-3 rounded-full bg-stage/80 px-6 py-3 text-h2 font-bold text-text-1 tabular-nums">
            <Captions aria-hidden className="size-8" />
            {ts("timingHint", { value: t("seconds", { value: signedSeconds.format(v.offsetHint) }) })}
          </span>
        </div>
      )}

      {v.showSkip && segment && !v.endShown && (
        <Button variant="secondary" size="lg" icon={FastForward} onClick={v.skip} className={CORNER}>
          {segment.kind === "intro" ? t("skipIntro") : segment.kind === "recap" ? t("skipRecap") : segment.kind === "outro" && props.next ? t("nextEpisode") : t("skipCredits")}
        </Button>
      )}

      {v.startOver === "show" && !v.showSkip && v.nextCountdown === null && (
        <Button variant="secondary" size="lg" icon={SkipBack} onClick={v.onStartOver} className={CORNER}>
          {t("startOver")}
        </Button>
      )}

      {props.next && v.nextCountdown !== null && (
        <section aria-label={t("nextEpisode")} className="pointer-events-auto absolute bottom-36 end-4 z-10 w-80 animate-fade-up rounded-md border border-line bg-stage/85 p-4 backdrop-blur in-data-[tv=1]:backdrop-blur-none md:end-8">
          <p className="text-body-s font-semibold text-text-2" aria-live="polite">
            {t("nextIn", { seconds: v.nextCountdown })}
          </p>
          <p className="mt-1 line-clamp-2 text-title text-text-1">{props.next.label}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" icon={FastForward} onClick={props.next.go} className="flex-1">
              {t("playNow")}
            </Button>
            <IconButton icon={X} label={t("nextCancel")} size="sm" onClick={v.onNextCancel} />
          </div>
        </section>
      )}

      {v.endShown && props.end && <TvEndScreen end={props.end} title={props.title} onReplay={v.onReplay} />}

      <PlayerPanels {...v.panels} />
    </>
  );
}

/** The skip / start-over buttons above the controls. */
const CORNER = "pointer-events-auto absolute bottom-36 end-4 z-10 animate-fade-up md:end-8";

/** A control of the bar (11.1): IconButton `stage` 48, the play icon filled (6.4). `tvPlay`: where the remote's up/down put the focus. */
function Control({ icon, label, onClick, filled, tvPlay }: { icon: typeof Play; label: string; onClick: () => unknown; filled?: boolean; tvPlay?: boolean }) {
  return <IconButton icon={icon} label={label} variant="stage" size="lg" onClick={() => void onClick()} data-tv-play={tvPlay || undefined} className={filled ? "[&_svg]:fill-current" : undefined} />;
}

/**
 * The end of a film in the TV shell (PLR-04), as it was before the site's redesign (TV document §6): "Watch again"
 * (the focus), "To the film", whether it went into the history, a few titles like it.
 */
function TvEndScreen({ end, title, onReplay }: { end: EndInfo; title: string; onReplay: () => void }) {
  const t = useTranslations("player");
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    again.current?.focus({ preventScroll: true });
  }, []);
  const related = end.related.filter((r) => r.posterPath).slice(0, 6);
  return (
    <section aria-labelledby="end-h" className="pointer-events-auto absolute inset-0 z-10 overflow-y-auto bg-stage/90 backdrop-blur in-data-[tv=1]:backdrop-blur-none">
      <div className="mx-auto flex min-h-full w-full max-w-tool flex-col justify-center gap-8 p-4 pt-[max(24px,env(safe-area-inset-top))] md:p-12">
        <div className="flex flex-col gap-3">
          <h2 id="end-h" className="text-h2 text-text-1">
            {t("endTitle", { title })}
          </h2>
          <Marked end={end} />
          <div className="mt-2 flex flex-wrap gap-3 max-sm:flex-col">
            <Button ref={again} size="lg" icon={RotateCcw} onClick={onReplay}>
              {t("watchAgain")}
            </Button>
            <Link href={end.titleHref} className={buttonClass("secondary", "lg")}>
              {t(end.kind === "movie" ? "toFilm" : "toSeries")}
            </Link>
          </div>
        </div>
        {related.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-h3 text-text-1">{t("endMoreLike")}</h3>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {related.map((r) => (
                <li key={r.id}>
                  <Link href={titleHref(r.kind, r.tmdbId, r.title)} className="group flex flex-col gap-2 rounded-sm">
                    <img src={tmdbImage(r.posterPath, "w185") ?? undefined} alt="" loading="lazy" className="aspect-2/3 w-full rounded-sm bg-surface-2 object-cover" />
                    <span className="line-clamp-2 text-body-s text-text-1">{r.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
