"use client";

import { Container, Controls, Gesture, Hotkey, TimeSlider, useContainer } from "@videojs/react";
import { I18nProvider } from "@videojs/react/i18n";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { usePlayer, Video, VideoPlayer } from "@videojs/react/video";
import { clsx } from "clsx";
import {
  ArrowLeft,
  Captions,
  Cast,
  FastForward,
  Layers,
  ListVideo,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type PointerEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { isBackKey, useTvNavOptional } from "@/components/tvui/nav/context";
import { BrandLoader } from "@/components/ui/BrandMotion";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PortalContainerContext } from "@/components/ui/portal";
import { Slider } from "@/components/ui/Slider";
import { formatClock, formatSize } from "@/lib/format";
import { detectCapabilities } from "@/lib/media/capabilities";
import { background } from "@/lib/optional";
import type { RemuxHandle } from "@/lib/media/remux";
import type { MediaSegment, PreparedPlayback, TrickplayInfo } from "@/lib/media/types";
import { EndScreen, type EndInfo } from "./EndScreen";
import { type EpisodesInfo, PlayerPanels, type PlayerPanel, type SourcesInfo } from "./PlayerPanels";

export interface PlayerEvents {
  onTime: (positionSec: number, durationSec: number | null, paused: boolean) => void;
  onPlay: (positionSec: number) => void;
  onPause: (positionSec: number) => void;
  onEnded: (positionSec: number) => void;
  onFatal: (message: string, code: number | null) => void;
}

export interface PlayerProps extends PlayerEvents {
  prepared: PreparedPlayback;
  title: string;
  subtitle: string | null;
  poster: string | null;
  startAt: number;
  /** `startAt` is the profile's saved position (not a source or audio switch): "Start over" is offered for a moment. */
  resumed?: boolean;
  /**
   * Kept while the sources screen is shown over it (PLR-03): paused, out of sight, its keys off; shown again it plays
   * on from where it was, without preparing anything again.
   */
  hidden?: boolean;
  onBack: () => void;
  /** Another audio track, from this position. */
  onAudioChange?: (index: number, positionSec: number) => void;
  /** "Season 1, episode 5 · Pilot" and the way there. */
  next: { label: string; go: () => void } | null;
  /** Every season's episodes, for the in-player list. */
  episodes?: EpisodesInfo | null;
  /** This title's copies and the search for another (the "Source" panel). */
  sources?: SourcesInfo | null;
  /** What plays, in words (PLR-05): the copy's version and its server. */
  info: { version: string; server: string };
  /** What the end of a film offers (PLR-04); null for an episode with a next one. */
  end?: EndInfo | null;
  /** The title's own language, for naming the original audio track. */
  originalLanguage: string | null;
  /** The title ("movie:603"): the subtitles chosen for it are remembered per profile on this device. */
  titleId?: string;
  footerNote?: ReactNode;
}

const VOLUME_KEY = "lumovio.player.volume";
const TIME_KEY = "lumovio.player.remaining";

export function LumovioPlayer(props: PlayerProps) {
  const { prepared } = props;
  const t = useTranslations("player");
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const remux = useRemux(videoRef, prepared, props.startAt, props.onFatal);
  const subtitleMeta = useSubtitles(videoRef, prepared, props.titleId ?? null);
  const caps = detectCapabilities();
  const useHlsJs = prepared.type === "hls" && caps.hls === "mse";
  // Text tracks from other origins need CORS mode on the element; only enable it when tracks exist.
  const cors: "anonymous" | undefined = prepared.subtitles.length > 0 ? "anonymous" : undefined;
  const tracks = prepared.subtitles.map((s) => <track key={s.id} kind={s.kind} src={s.url} srcLang={s.lang} label={s.label} />);
  const common = {
    // The letterbox around the frame is the video's own black (design-system 3.6: video frames).
    className: "absolute inset-0 size-full bg-black object-contain",
    playsInline: true,
    autoPlay: true,
    preload: "auto" as const,
    crossOrigin: cors,
    poster: props.poster ?? undefined,
  };

  return (
    // The player's own words (its live announcements, the timeline's value) in the site's language (PLR-09).
    <I18nProvider locale={locale}>
      <VideoPlayer>
        {/* The player is a stage (3.5): dark roles in either theme. Kept while hidden, so it goes on where it was. */}
        <Container
          className={clsx("stage group/player fixed inset-0 z-player overflow-hidden bg-black select-none focus:outline-none", props.hidden && "hidden")}
          aria-label={t("playerName", { title: props.title })}
          // Kept out of sight, it is not the page's player: the TV navigation and "Playback info" look for these.
          data-nav-trap={props.hidden ? undefined : true}
          data-player={props.hidden ? undefined : true}
          tabIndex={-1}
        >
          {useHlsJs ? (
            <HlsJsVideo {...common} ref={videoRef} src={prepared.url}>
              {tracks}
            </HlsJsVideo>
          ) : (
            <Video {...common} ref={videoRef} src={prepared.type === "remux" ? undefined : prepared.url}>
              {tracks}
            </Video>
          )}
          <Chrome {...props} {...(remux ?? {})} subtitleMeta={subtitleMeta} />
        </Container>
      </VideoPlayer>
    </I18nProvider>
  );
}

/**
 * A file rebuilt in the browser (`lib/media/remux.ts`, loaded only then): the engine owns the
 * element's source, and audio tracks switch in place, at the same position.
 */
function useRemux(ref: RefObject<HTMLVideoElement | null>, prepared: PreparedPlayback, startAt: number, onFatal: PlayerEvents["onFatal"]) {
  const [audio, setAudio] = useState(prepared.remuxAudio);
  const handle = useRef<RemuxHandle | null>(null);
  const fatal = useRef(onFatal);
  const start = useRef(startAt);
  useEffect(() => {
    fatal.current = onFatal;
  });
  useEffect(() => {
    const video = ref.current;
    if (prepared.type !== "remux" || !video) return;
    const abort = new AbortController();
    const position = Math.max(0, prepared.audio.findIndex((a) => a.index === prepared.remuxAudio));
    // An old AVI has its own engine (decoded in WASM, encoded to H.264 here); the rest Mediabunny's rebuild.
    (prepared.remuxEngine === "legacy" ? import("@/lib/media/legacy").then((m) => m.startLegacy) : import("@/lib/media/remux").then((m) => m.startRemux))
      .then((begin) =>
        begin(video, {
          // The server's own address with its sign-in, which the engine sends itself (no service worker in between).
          url: prepared.remuxSource?.url ?? prepared.url,
          headers: prepared.remuxSource?.headers,
          targetAddressSpace: prepared.remuxSource?.targetAddressSpace,
          audioPosition: position,
          startAt: start.current,
          durationSec: prepared.durationSec,
          onError: (msg) => fatal.current(msg, null),
          signal: abort.signal,
        }),
      )
      .then((h) => {
        if (abort.signal.aborted) h.destroy();
        else handle.current = h;
      })
      .catch((e) => {
        if (!abort.signal.aborted) fatal.current((e as Error).message, null);
      });
    return () => {
      abort.abort();
      handle.current?.destroy();
      handle.current = null;
    };
  }, [prepared, ref]);
  if (prepared.type !== "remux") return null;
  return {
    prepared: { ...prepared, audio: prepared.audio.map((a) => ({ ...a, isDefault: a.index === audio })) },
    onAudioChange: (index: number) => {
      const position = prepared.audio.findIndex((a) => a.index === index);
      if (position < 0 || index === audio) return;
      setAudio(index);
      handle.current?.selectAudio(position);
    },
  };
}

/** What the player's menu says about a subtitle track beyond its language and name, by the player store's track id. */
export type SubtitleMeta = Map<string, { forced: boolean; format: "srt" | "vtt" | "ass" | "pgs"; file: boolean }>;

/**
 * Subtitles the browser can't read itself (PLR-14; `lib/media/subs/engine.ts`, loaded only for a playback that has
 * them): the file's own tracks and the torrent's subtitle files become text tracks of the <video>, which the menu and
 * the C key choose; the one shown at the start is the title's remembered choice, else the profile's (`subs/choice.ts`),
 * and a choice the person makes is remembered for the title.
 */
function useSubtitles(ref: RefObject<HTMLVideoElement | null>, prepared: PreparedPlayback, titleId: string | null): SubtitleMeta {
  const { me } = useSession();
  const profile = me?.activeProfile ?? null;
  const prefs = useRef({ audio: profile?.audioLanguages ?? [], subs: profile?.subtitleLanguages ?? [], key: titleId ? `${profile?.id ?? "guest"}:${titleId}` : null });
  const [meta, setMeta] = useState<SubtitleMeta>(() => new Map());
  useEffect(() => {
    const video = ref.current;
    const src = prepared.subtitleSources;
    if (!video || !src) return;
    const abort = new AbortController();
    let engine: { destroy(): void } | null = null;
    let onChange: (() => void) | null = null;
    const audioLang = prepared.audio.find((a) => a.isDefault)?.lang ?? null;
    // Subtitles are an extra of the stream: when they can't be read, the film plays without them.
    background(
      Promise.all([import("@/lib/media/subs/engine"), import("@/lib/media/subs/choice")]).then(async ([e, c]) => {
        const handle = await e.startSubtitles({
          video,
          file: src.file,
          files: src.files,
          headers: src.headers,
          targetAddressSpace: src.targetAddressSpace,
          signal: abort.signal,
          onTracks: (tracks) => {
            const all = Array.from(video.textTracks);
            setMeta(new Map(tracks.map((x) => [`track:${all.indexOf(x.track)}:subtitles:${x.track.language}:${x.track.label}`, { forced: x.forced, format: x.format, file: x.origin === "file" }])));
            const key = prefs.current.key;
            const at = c.pickSubtitle(tracks, { memory: key ? c.loadMemory(key) : null, audioLang, audioLanguages: prefs.current.audio, subtitleLanguages: prefs.current.subs });
            let lastSet: TextTrack | null = at === null ? null : tracks[at]!.track;
            if (lastSet) lastSet.mode = "showing";
            // The person's own choice (menu, C key) is remembered for the title; the one made above isn't theirs.
            onChange = () => {
              const shown = tracks.find((x) => x.track.mode === "showing") ?? null;
              if ((shown?.track ?? null) === lastSet || !key) return;
              lastSet = shown?.track ?? null;
              c.saveMemory(key, shown ? { lang: shown.lang, forced: shown.forced, name: shown.name } : { off: true });
            };
            video.textTracks.addEventListener("change", onChange);
          },
        });
        if (abort.signal.aborted) handle.destroy();
        else engine = handle;
      }),
    );
    return () => {
      abort.abort();
      if (onChange) video.textTracks.removeEventListener("change", onChange);
      engine?.destroy();
      engine = null;
    };
  }, [prepared, ref]);
  return meta;
}

/** One timeline thumbnail cut out of a trickplay sprite sheet. */
function TrickplayThumb({ tp, time }: { tp: TrickplayInfo; time: number }) {
  const n = Math.max(0, Math.min(tp.count - 1, Math.floor((time * 1000) / tp.intervalMs)));
  const perSheet = tp.cols * tp.rows;
  const sheet = Math.floor(n / perSheet);
  const i = n % perSheet;
  const scale = 192 / tp.width;
  return (
    <div
      aria-hidden
      className="mb-1.5 overflow-hidden rounded-sm bg-black ring-1 ring-line-2"
      style={{
        width: tp.width * scale,
        height: tp.height * scale,
        backgroundImage: `url("${tp.tileUrl(sheet)}")`,
        backgroundPosition: `-${(i % tp.cols) * tp.width * scale}px -${Math.floor(i / tp.cols) * tp.height * scale}px`,
        backgroundSize: `${tp.cols * tp.width * scale}px ${tp.rows * tp.height * scale}px`,
      }}
    />
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [role="slider"], [tabindex]:not([tabindex="-1"])';
const EDITABLE = /INPUT|TEXTAREA|SELECT/;

function Chrome(props: PlayerProps & { subtitleMeta: SubtitleMeta }) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const locale = useLocale();
  const store = usePlayer();
  const paused = usePlayer((s) => s.paused);
  const ended = usePlayer((s) => s.ended);
  const waiting = usePlayer((s) => s.waiting);
  const started = usePlayer((s) => s.started);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const buffered = usePlayer((s) => s.buffered);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const isFullscreen = usePlayer((s) => s.isFullscreen);
  const error = usePlayer((s) => s.error);
  const controlsVisible = usePlayer((s) => s.controlsVisible);
  const pipAvail = usePlayer((s) => s.pictureInPictureAvailability);
  const isPip = usePlayer((s) => s.isPictureInPicture);
  const castAvail = usePlayer((s) => s.remotePlaybackAvailability);
  const subtitlesShowing = usePlayer((s) => s.subtitlesShowing);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [panel, setPanel] = useState<PlayerPanel>("none");
  const [remaining, setRemaining] = useState(() => {
    try {
      return localStorage.getItem(TIME_KEY) === "1";
    } catch {
      return false;
    }
  });
  const { tv } = useSession();
  // In the TV shell (tvui): the remote's own model of the player — see the keys below (TV document §6).
  const tvNav = useTvNavOptional();
  const [seekHint, setSeekHint] = useState<{ delta: number; at: number } | null>(null);
  const container = useContainer();
  const startedRef = useRef(false);
  const lastTick = useRef(0);
  const segments = props.prepared.segments ?? [];
  const outro = segments.find((s) => s.kind === "outro");
  const hidden = Boolean(props.hidden);

  // The keys work at once (PLR-01): the player takes the focus when it opens and when it is shown again; kept out
  // of sight it pauses, and plays on when it is back.
  const wasHidden = useRef(hidden);
  useEffect(() => {
    if (hidden) {
      void store.pause();
      if (isFullscreen) void store.exitFullscreen();
    } else {
      container?.focus({ preventScroll: true });
      if (wasHidden.current) void store.play();
    }
    wasHidden.current = hidden;
  }, [hidden, container, store, isFullscreen]);

  // Resume position once metadata is known.
  useEffect(() => {
    if (!startedRef.current && duration > 0 && props.startAt > 5 && props.startAt < duration - 10 && (props.prepared.type === "progressive" || props.prepared.seekOnStart)) {
      startedRef.current = true;
      void store.seek(props.startAt);
    } else if (duration > 0) startedRef.current = true;
  }, [duration, props.startAt, props.prepared.type, props.prepared.seekOnStart, store]);

  // "Start over" once playback has actually landed on the saved position; it goes after 10 s of
  // playback from there, or as soon as the position moves elsewhere.
  const [startOver, setStartOver] = useState<"wait" | "show" | "gone">(props.resumed ? "wait" : "gone");
  useEffect(() => {
    if (startOver === "gone" || !started) return;
    const near = currentTime > props.startAt - 10 && currentTime < props.startAt + 10;
    if (startOver === "wait" && near) setStartOver("show");
    else if (startOver === "show" && !near) setStartOver("gone");
  }, [startOver, started, currentTime, props.startAt]);

  // While a torrent buffers, what its server reports (peers, speed, loaded) — asked every 2 s only then.
  const [torrent, setTorrent] = useState<Awaited<ReturnType<NonNullable<PreparedPlayback["stats"]>>>>(null);
  const stats = props.prepared.stats;
  const buffering = (waiting || !started) && !error && !hidden;
  useEffect(() => {
    if (!stats || !buffering) return;
    let live = true;
    const tick = () => void stats().then((s) => live && setTorrent(s));
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [stats, buffering]);

  // A plain stream that never gets as far as its metadata while the torrent already holds plenty (a browser that takes
  // the file and then neither plays nor fails, as Firefox did with HEVC through the service worker): after 30 s it
  // counts as a format failure, so the player rebuilds it or names another way, instead of loading for ever.
  const stuckSince = useRef<number | null>(null);
  useEffect(() => {
    if (props.prepared.type !== "progressive" || started || error || hidden) {
      stuckSince.current = null;
      return;
    }
    const v = container?.querySelector("video");
    if (!v || v.readyState > 0 || (torrent?.preloadedBytes ?? 0) < 32 * 1024 * 1024) return;
    const now = Date.now();
    stuckSince.current ??= now;
    if (now - stuckSince.current > 30_000) {
      stuckSince.current = Number.POSITIVE_INFINITY;
      props.onFatal("no metadata from the plain stream", 4);
    }
  }, [torrent, started, error, hidden, container, props]);

  // Remember volume / mute between sessions (per browser).
  const volumeLoaded = useRef(false);
  useEffect(() => {
    if (volumeLoaded.current) return;
    volumeLoaded.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? "null") as { v: number; m: boolean } | null;
      if (saved) {
        store.setVolume(Math.min(1, Math.max(0, saved.v)));
        store.setMuted(saved.m);
      }
    } catch {
      /* storage unavailable */
    }
  }, [store]);
  useEffect(() => {
    if (!started) return;
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify({ v: volume, m: muted }));
    } catch {
      /* storage unavailable */
    }
  }, [volume, muted, started]);

  // Progress beacons: every ~10 s of playback, plus on pause/play/end.
  useEffect(() => {
    const now = Date.now();
    if (!paused && now - lastTick.current > 10_000 && currentTime > 0) {
      lastTick.current = now;
      props.onTime(currentTime, duration || props.prepared.durationSec, false);
    }
  }, [currentTime, paused, duration, props]);
  const prevPaused = useRef(paused);
  useEffect(() => {
    if (prevPaused.current !== paused && started) {
      if (paused) props.onPause(currentTime);
      else props.onPlay(currentTime);
    }
    prevPaused.current = paused;
  }, [paused, started, currentTime, props]);
  useEffect(() => {
    if (ended) props.onEnded(currentTime);
  }, [ended, currentTime, props]);
  useEffect(() => {
    if (error) props.onFatal(error.message, error.code);
  }, [error, props]);

  // "Next episode" card from the credits marker, or the last 25 s; auto-advance after a countdown.
  const left = duration > 0 ? duration - currentTime : Number.POSITIVE_INFINITY;
  const inCredits = Boolean(outro && currentTime >= outro.start);
  useEffect(() => {
    if (!props.next || hidden) return;
    if ((left < 25 || ended || inCredits) && nextCountdown === null) setNextCountdown(ended ? 8 : 15);
  }, [left, ended, inCredits, props.next, nextCountdown, hidden]);
  useEffect(() => {
    if (nextCountdown === null || !props.next || hidden) return;
    if (nextCountdown <= 0) {
      props.next.go();
      return;
    }
    const id = setTimeout(() => setNextCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(id);
  }, [nextCountdown, props.next, hidden]);

  // Skip button for the segment we're in (not for previews / ads, and not when the next-episode card shows).
  const segment: MediaSegment | undefined = segments.find((s) => s.kind !== "preview" && currentTime >= s.start && currentTime < s.end - 1);
  const showSkip = segment && !(segment.kind === "outro" && props.next && nextCountdown !== null);
  const skip = () => {
    if (!segment) return;
    if (segment.kind === "outro" && props.next) props.next.go();
    else void store.seek(segment.end);
  };

  // The end of a film (or of a series' last episode): its own screen (PLR-04).
  const endShown = ended && !props.next && Boolean(props.end);

  // A panel keeps the controls up: they'd fade after 2 s without movement with the panel still open.
  const layerOpen = panel !== "none";
  useEffect(() => (layerOpen ? store.requestControlsLock() : undefined), [layerOpen, store]);
  // On a TV a panel is a layer of the shell: an entry in the history, so the TV browser's own Back closes the panel and
  // not the player (TV document TV3).
  useEffect(() => {
    if (!tvNav || !layerOpen) return;
    const layer = tvNav.openLayer(() => setPanel("none"));
    return () => layer.dismiss();
  }, [tvNav, layerOpen]);
  // The TV app keeps the screen on while a video plays (window.LumovioTV, apps/tv-android), off when it stops.
  useEffect(() => {
    const app = (window as { LumovioTV?: { keepScreenOn?: (on: boolean) => void } }).LumovioTV;
    if (!tvNav || !app?.keepScreenOn) return;
    app.keepScreenOn(started && !paused && !ended);
    return () => app.keepScreenOn?.(false);
  }, [tvNav, started, paused, ended]);
  // The seek hint of the remote's arrows fades after a second.
  useEffect(() => {
    if (!seekHint) return;
    const id = window.setTimeout(() => setSeekHint(null), 1200);
    return () => window.clearTimeout(id);
  }, [seekHint]);
  // A control keeps the remote's focus only while it can be seen: after 6 s without a key (playing, no panel) the bar
  // goes and the focus is back on the picture, where the arrows seek again.
  const lastKey = useRef(0);
  const backHidAt = useRef(0);
  useEffect(() => {
    if (!tvNav || paused || layerOpen) return;
    const id = window.setInterval(() => {
      const onControl = container?.contains(document.activeElement) && document.activeElement !== container;
      if (onControl && Date.now() - lastKey.current > 6000) {
        store.toggleControls(false);
        container?.focus({ preventScroll: true });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [tvNav, paused, layerOpen, container, store]);

  // While a panel is open, keys and clicks belong to it: the player's shortcuts and click gestures stand down, and
  // stay off a moment after it closes (the click that closed it isn't a pause).
  const [inputOff, setInputOff] = useState(false);
  useEffect(() => {
    if (layerOpen || hidden || endShown) {
      setInputOff(true);
      return;
    }
    const id = setTimeout(() => setInputOff(false), 300);
    return () => clearTimeout(id);
  }, [layerOpen, hidden, endShown]);

  const togglePlay = () => (paused || ended ? store.play() : store.pause());

  // On the way down, before Radix, the TV navigation and the focused button see it:
  // - Escape (a TV remote's Back) closes one layer and nothing else;
  // - Space always plays or pauses (PLR-02) — never "presses" the last button used;
  // - Tab stays inside the player (PLR-09);
  // - S skip · N next episode · I playback info · ? shortcuts.
  useEffect(() => {
    if (hidden) return;
    const inPlayer = (el: EventTarget | null) => el instanceof Node && Boolean(container?.contains(el));
    const inList = (el: EventTarget | null) => el instanceof Element && Boolean(el.closest('[role="listbox"],[role="menu"]'));
    const stop = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const down = (e: KeyboardEvent) => {
      lastKey.current = Date.now();
      if (e.key === "Escape" || (tv && isBackKey(e))) {
        if (inList(e.target)) return;
        if (layerOpen) setPanel("none");
        else if (tvNav && !endShown) {
          // The remote's Back: the controls go first (the focus back on the picture), then the player.
          // (A key shows the controls again by itself: a Back right after the one that hid them leaves.)
          const onControl = container?.contains(document.activeElement) && document.activeElement !== container;
          const now = Date.now();
          if (onControl || (controlsVisible && !paused && now - backHidAt.current > 2000)) {
            backHidAt.current = now;
            store.toggleControls(false);
            container?.focus({ preventScroll: true });
          } else props.onBack();
        } else return;
        stop(e);
        return;
      }
      // The remote over the picture (TV document §6): OK plays or pauses, left/right seek with a hint, up/down bring the
      // controls with the focus on "Pause"; on a control the arrows move between controls (the shell) and OK presses it.
      if (tvNav && !layerOpen && !endShown) {
        const onControl = container?.contains(document.activeElement) && document.activeElement !== container;
        if (!onControl) {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            const forward = (e.key === "ArrowRight") !== (document.documentElement.dir === "rtl");
            const step = (e.repeat ? 30 : 10) * (forward ? 1 : -1);
            const to = Math.max(0, Math.min(duration > 0 ? duration - 1 : Number.POSITIVE_INFINITY, currentTime + step));
            void store.seek(to);
            store.toggleControls(true);
            setSeekHint((h) => ({ delta: (h && Date.now() - h.at < 1200 && Math.sign(h.delta) === Math.sign(step) ? h.delta : 0) + step, at: Date.now() }));
            stop(e);
            return;
          }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            store.toggleControls(true);
            requestAnimationFrame(() => container?.querySelector<HTMLElement>("[data-tv-play]")?.focus({ preventScroll: true }));
            stop(e);
            return;
          }
          if (e.key === "Enter") {
            stop(e);
            if (e.repeat) return;
            store.toggleControls(true);
            void togglePlay();
            return;
          }
        } else if (e.key.startsWith("Arrow")) {
          store.toggleControls(true);
        }
      }
      if (layerOpen || endShown) return;
      const el = e.target as HTMLElement | null;
      if (el && EDITABLE.test(el.tagName)) return;
      if (e.key === " " || e.code === "Space") {
        if (e.repeat) return e.preventDefault();
        e.preventDefault();
        e.stopPropagation();
        store.toggleControls(true);
        void togglePlay();
        return;
      }
      if (e.key === "Tab" && container) {
        const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.getClientRects().length > 0 && !x.closest("[aria-hidden=true],[inert]"));
        if (items.length === 0) return;
        store.toggleControls(true);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i < 0 || i >= items.length - 1 ? 0 : i + 1;
        e.preventDefault();
        items[next]!.focus();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "s" || e.key === "S") skip();
      else if ((e.key === "n" || e.key === "N") && props.next) props.next.go();
      else if (e.key === "i" || e.key === "I") setPanel("info");
      else if (e.key === "?") setPanel("help");
      else {
        // Any other key shows the controls, even when the focus is not on the player.
        if (!inPlayer(e.target)) store.toggleControls(true);
        return;
      }
      e.preventDefault();
    };
    // A button "pressed" by Space on its keyup: the press was the pause above, not a click.
    const up = (e: KeyboardEvent) => {
      if ((e.key === " " || e.code === "Space") && !layerOpen && inPlayer(e.target) && (e.target as HTMLElement).tagName === "BUTTON") e.preventDefault();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  });

  const bufferedAhead = (() => {
    const r = buffered.find(([s, e]) => currentTime >= s - 0.5 && currentTime <= e + 0.5);
    return r ? Math.max(0, r[1] - currentTime) : 0;
  })();
  const showChrome = (controlsVisible || paused || !started || layerOpen) && !endShown;
  // Text subtitles move up above the controls while they show, and back down when they fade (readable either way).
  useEffect(() => {
    const v = container?.querySelector("video");
    if (!v) return;
    const line = showChrome ? -4 : "auto";
    // Subtitles drawn on a canvas over the picture — ASS by libass, PGS pictures — keep their own layout: the layer
    // moves up just as far as the picture's lower edge is under the controls, and back down (PLR-18).
    const liftCanvases = () => {
      const bar = container?.querySelector<HTMLElement>("[data-player-bar]");
      for (const c of container?.querySelectorAll<HTMLElement>("canvas.JASSUB, canvas[data-subtitles]") ?? []) {
        const under = showChrome && bar && container ? c.offsetTop + c.offsetHeight - (bar.getBoundingClientRect().top - container.getBoundingClientRect().top) : 0;
        c.style.transition = "translate var(--dur-slow) var(--ease-base)";
        c.style.translate = under > 0 ? `0 ${-Math.round(under)}px` : "";
      }
    };
    const lift = () => {
      liftCanvases();
      for (const track of Array.from(v.textTracks)) {
        if (track.mode !== "showing") continue;
        let moved = false;
        for (const cue of Array.from(track.cues ?? []))
          if (cue instanceof VTTCue && cue.line !== line) {
            cue.line = line;
            moved = true;
          }
        // A paused video doesn't lay its cues out again by itself: showing the track anew does.
        if (moved && v.paused) {
          track.mode = "hidden";
          track.mode = "showing";
        }
      }
    };
    lift();
    v.textTracks.addEventListener("change", lift);
    v.textTracks.addEventListener("addtrack", lift);
    // Cues keep arriving as a track is read: new ones follow on the next frame the controls change, or every 2 s.
    const id = showChrome ? window.setInterval(lift, 2000) : undefined;
    return () => {
      v.textTracks.removeEventListener("change", lift);
      v.textTracks.removeEventListener("addtrack", lift);
      window.clearInterval(id);
    };
  }, [showChrome, container]);
  // Faded-out controls take no taps: the first tap on a phone shows them instead of pressing an unseen button.
  const hit = showChrome ? "pointer-events-auto" : "pointer-events-none";
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const tp = props.prepared.trickplay ?? null;
  const onSliderMove = (e: PointerEvent<HTMLElement>) => {
    if (duration <= 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    let f = (e.clientX - r.left) / r.width;
    if (getComputedStyle(e.currentTarget).direction === "rtl") f = 1 - f;
    setHoverTime(Math.max(0, Math.min(1, f)) * duration);
  };
  const toggleTime = () => {
    setRemaining((v) => {
      try {
        localStorage.setItem(TIME_KEY, v ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !v;
    });
  };
  const known = duration > 0;
  const timeText = !known ? "--:--" : remaining ? `−${formatClock(Math.max(0, duration - currentTime))}` : `${formatClock(currentTime)} / ${formatClock(duration)}`;
  const off = inputOff;

  return (
    // Menus, panels and hints open inside the player: in fullscreen only the player is shown.
    <PortalContainerContext.Provider value={container}>
      <Controls.Root>
        {/* Space is the handler above (PLR-02); the others listen on the page, so they work before any click (PLR-01). */}
        <Hotkey keys="k" action="togglePaused" target="document" disabled={off} />
        {/* On TV the remote's arrows are handled by spatial navigation (seek only when no control is focused). */}
        {!tv && <Hotkey keys="ArrowLeft" action="seekStep" value={-10} target="document" disabled={off} />}
        {!tv && <Hotkey keys="ArrowRight" action="seekStep" value={10} target="document" disabled={off} />}
        <Hotkey keys="j" action="seekStep" value={-10} target="document" disabled={off} />
        <Hotkey keys="l" action="seekStep" value={10} target="document" disabled={off} />
        {!tv && <Hotkey keys="ArrowUp" action="volumeStep" value={0.05} target="document" disabled={off} />}
        {!tv && <Hotkey keys="ArrowDown" action="volumeStep" value={-0.05} target="document" disabled={off} />}
        <Hotkey keys="m" action="toggleMuted" target="document" disabled={off} />
        <Hotkey keys="f" action="toggleFullscreen" target="document" disabled={off} />
        <Hotkey keys="c" action="toggleSubtitles" target="document" disabled={off || (props.prepared.subtitles.length === 0 && props.subtitleMeta.size === 0)} />
        <Hotkey keys="0-9" action="seekToPercent" target="document" disabled={off} />
        <Gesture type="tap" action="togglePaused" pointer="mouse" disabled={off} />
        <Gesture type="doubletap" action="toggleFullscreen" pointer="mouse" region="center" disabled={off} />
        <Gesture type="doubletap" action="seekStep" value={-10} pointer="touch" region="left" disabled={off} />
        <Gesture type="doubletap" action="seekStep" value={10} pointer="touch" region="right" disabled={off} />
        {/* Scrims for the title and the controls, in the stage colour (3.5). */}
        <Controls.Backdrop className={clsx("pointer-events-none absolute inset-0 transition-opacity duration-slow", showChrome ? "opacity-100" : "opacity-0")}>
          <div className="absolute inset-x-0 top-0 h-1/4 bg-linear-to-b from-stage/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-stage/90 to-transparent" />
        </Controls.Backdrop>

        {buffering && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-3 rounded-md bg-stage/50 px-5 py-4 backdrop-blur in-data-[tv=1]:backdrop-blur-none">
              <BrandLoader size="lg" />
              <p className="text-body-s font-semibold text-text-1">{started ? t("buffering", { percent: Math.min(99, Math.round((bufferedAhead / 10) * 100)) }) : t("loading")}</p>
              {torrent && (torrent.peers !== null || torrent.speedBps !== null) && (
                <p className="text-caption text-text-2">
                  {[
                    torrent.peers !== null ? t("torrentPeers", { count: torrent.peers }) : null,
                    torrent.speedBps !== null ? t("torrentSpeed", { speed: formatSize(torrent.speedBps, locale) ?? "0" }) : null,
                    torrent.preloadedBytes ? t("torrentLoaded", { size: formatSize(torrent.preloadedBytes, locale) ?? "" }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Touch screens: back, play and forward in the middle, like streaming apps; the bar then has no second set (PLR-12). */}
        <div className={clsx("pointer-events-none absolute inset-0 hidden items-center justify-center gap-10 transition-opacity duration-slow pointer-coarse:flex", showChrome ? "opacity-100" : "opacity-0")}>
          <IconButton icon={RotateCcw} label={t("back10")} variant="stage" size="lg" className={hit} onClick={() => void store.seek(Math.max(0, currentTime - 10))} />
          <IconButton icon={paused ? Play : Pause} label={paused ? t("play") : t("pause")} variant="stage" size="lg" className={clsx(hit, "[&_svg]:fill-current")} onClick={() => void togglePlay()} />
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
              onPointerMove={onSliderMove}
              onPointerLeave={() => setHoverTime(null)}
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
                {tp && hoverTime !== null && <TrickplayThumb tp={tp} time={hoverTime} />}
                <span className="rounded-xs bg-stage/85 px-2 py-1 text-caption font-bold tabular-nums">
                  <TimeSlider.Value type="pointer" />
                </span>
              </TimeSlider.Preview>
            </TimeSlider.Root>

            <div className="flex items-center gap-1 md:gap-2">
              <span className="contents pointer-coarse:hidden">
                <Control icon={paused ? Play : Pause} filled label={paused ? t("play") : t("pause")} onClick={togglePlay} tvPlay />
                <Control icon={RotateCcw} label={t("back10")} onClick={() => store.seek(Math.max(0, currentTime - 10))} />
                <Control icon={RotateCw} label={t("forward10")} onClick={() => store.seek(currentTime + 10)} />
              </span>
              {/* Volume with a mouse: the button always, its slider always on a wide screen, by focus or hover below (PLR-10).
                  On touch screens and TVs the device's own buttons set it (on a TV the slider would keep the remote's arrows). */}
              <div className="group/vol hidden items-center gap-1 pointer-fine:flex in-data-[tv=1]:hidden!">
                <Control icon={VolIcon} label={muted ? t("unmute") : t("mute")} onClick={() => store.setMuted(!muted)} />
                {/* Arrows belong to the slider, not the TV's spatial navigation. */}
                <div data-nav-native className="w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-base ease-base group-hover/vol:w-24 group-hover/vol:opacity-100 focus-within:w-24 focus-within:opacity-100 lg:w-24 lg:opacity-100">
                  <Slider
                    variant="player"
                    label={tc("volume")}
                    valueText={`${Math.round((muted ? 0 : volume) * 100)} %`}
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onValueChange={(v) => {
                      store.setVolume(v);
                      if (muted) store.setMuted(false);
                    }}
                    className="px-2"
                  />
                </div>
              </div>
              {/* One time, elapsed or remaining by a press (PLR-12). */}
              <Button variant="tertiary" size="sm" onClick={toggleTime} aria-label={remaining ? t("showElapsed") : t("showRemaining")} className="ms-1">
                <span className="tabular-nums">{timeText}</span>
              </Button>

              <div className="ms-auto flex items-center gap-1 md:gap-2">
                {props.next && <Control icon={SkipForward} label={t("nextEpisode")} onClick={props.next.go} />}
                {props.episodes && <Control icon={ListVideo} label={t("episodes")} onClick={() => setPanel("episodes")} />}
                {/* Always there, with one track or none too: the panel says what the file has (PLR-07). */}
                <span className="relative inline-flex">
                  <Control icon={Captions} label={t("audioAndSubtitles")} onClick={() => setPanel("tracks")} />
                  {subtitlesShowing && <span aria-hidden className="pointer-events-none absolute end-2 top-2 size-2 rounded-full bg-accent" />}
                </span>
                <Control icon={Settings2} label={t("qualityAndSpeed")} onClick={() => setPanel("settings")} />
                {props.sources && <Control icon={Layers} label={t("source")} onClick={() => setPanel("source")} />}
                {/* A TV shows the player on the whole screen anyway, and has no window to keep a picture in (TV-06). */}
                {!tvNav && pipAvail === "available" && <Control icon={PictureInPicture2} label={isPip ? t("exitPip") : t("pip")} onClick={() => (isPip ? store.exitPictureInPicture() : store.requestPictureInPicture())} />}
                {!tvNav && castAvail === "available" && <Control icon={Cast} label={t("cast")} onClick={() => store.promptRemotePlayback()} />}
                {!tvNav && (
                  <Control icon={isFullscreen ? Minimize : Maximize} label={isFullscreen ? t("exitFullscreen") : t("fullscreen")} onClick={() => (isFullscreen ? store.exitFullscreen() : store.requestFullscreen())} />
                )}
              </div>
            </div>
          </Controls.Group>
        </Controls.Content>

        {seekHint && (
          // The remote's seek, said where the eye is (TV document §6: clear feedback of seeking).
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/2 grid -translate-y-1/2 place-items-center">
            <span className="flex items-center gap-3 rounded-full bg-stage/80 px-6 py-3 text-h2 font-bold text-text-1 tabular-nums">
              {seekHint.delta < 0 ? <RotateCcw aria-hidden className="size-8" /> : <RotateCw aria-hidden className="size-8" />}
              {t(seekHint.delta < 0 ? "seekBack" : "seekForward", { seconds: Math.abs(seekHint.delta) })}
            </span>
          </div>
        )}

        {showSkip && segment && !endShown && (
          <Button variant="secondary" size="lg" icon={FastForward} onClick={skip} className={CORNER}>
            {segment.kind === "intro" ? t("skipIntro") : segment.kind === "recap" ? t("skipRecap") : segment.kind === "outro" && props.next ? t("nextEpisode") : t("skipCredits")}
          </Button>
        )}

        {startOver === "show" && !showSkip && nextCountdown === null && (
          <Button
            variant="secondary"
            size="lg"
            icon={SkipBack}
            onClick={() => {
              setStartOver("gone");
              void store.seek(0);
            }}
            className={CORNER}
          >
            {t("startOver")}
          </Button>
        )}

        {props.next && nextCountdown !== null && (
          <section aria-label={t("nextEpisode")} className="pointer-events-auto absolute bottom-36 end-4 z-10 w-80 animate-fade-up rounded-md border border-line bg-stage/85 p-4 backdrop-blur in-data-[tv=1]:backdrop-blur-none md:end-8">
            <p className="text-body-s font-semibold text-text-2" aria-live="polite">
              {t("nextIn", { seconds: nextCountdown })}
            </p>
            <p className="mt-1 line-clamp-2 text-title text-text-1">{props.next.label}</p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" icon={FastForward} onClick={props.next.go} className="flex-1">
                {t("playNow")}
              </Button>
              <IconButton icon={X} label={t("nextCancel")} size="sm" onClick={() => setNextCountdown(null)} />
            </div>
          </section>
        )}

        {endShown && props.end && <EndScreen end={props.end} title={props.title} onReplay={() => {
              void store.seek(0);
              void store.play();
            }} />}

        <PlayerPanels
          panel={panel}
          onPanel={setPanel}
          prepared={props.prepared}
          onAudioChange={props.onAudioChange}
          currentTime={currentTime}
          episodes={props.episodes ?? null}
          sources={props.sources ?? null}
          info={props.info}
          bufferedAhead={bufferedAhead}
          originalLanguage={props.originalLanguage}
          hasNext={Boolean(props.next)}
          hasSegments={segments.length > 0}
          subtitleMeta={props.subtitleMeta}
        />
      </Controls.Root>
    </PortalContainerContext.Provider>
  );
}

/** The skip / start-over buttons above the controls. */
const CORNER = "pointer-events-auto absolute bottom-36 end-4 z-10 animate-fade-up md:end-8";

/** A control of the bar (11.1): IconButton `stage` 48, the play icon filled (6.4). `tvPlay`: where a TV's up/down put the focus. */
function Control({ icon, label, onClick, filled, tvPlay }: { icon: typeof Play; label: string; onClick: () => unknown; filled?: boolean; tvPlay?: boolean }) {
  return <IconButton icon={icon} label={label} variant="stage" size="lg" onClick={() => void onClick()} data-tv-play={tvPlay || undefined} className={filled ? "[&_svg]:fill-current" : undefined} />;
}
