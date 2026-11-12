"use client";

import type { SubtitleStyle, TitleLogoArt } from "@lumovio/contracts";
import { Container, Controls, Gesture, Hotkey, TimeSlider, useContainer } from "@videojs/react";
import { I18nProvider } from "@videojs/react/i18n";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { usePlayer, Video, VideoPlayer } from "@videojs/react/video";
import { clsx } from "clsx";
import {
  ArrowLeft,
  Captions,
  CaptionsOff,
  Cast,
  FastForward,
  ListVideo,
  type LucideIcon,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type CSSProperties, type PointerEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { TitleLogo } from "@/components/media/TitleLogo";
import { useSession } from "@/components/providers/Providers";
import { isBackKey, useTvNavOptional } from "@/components/tvui/nav/context";
import { BrandLoader } from "@/components/ui/BrandMotion";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { PortalContainerContext } from "@/components/ui/portal";
import { Slider } from "@/components/ui/Slider";
import { api } from "@/lib/api";
import { formatClock, formatRuntime, formatSize } from "@/lib/format";
import { detectCapabilities, REMUXABLE_AUDIO } from "@/lib/media/capabilities";
import { watchLine } from "@/lib/media/line-speed";
import { loadOffset, saveOffset } from "@/lib/media/subs/choice";
import type { SubtitleFormat } from "@/lib/media/subs/engine";
import { OFFSET_STEP, SUBTITLE_DEFAULTS, setSubtitleView, shiftTrack, stepOffset, subtitleView } from "@/lib/media/subs/view";
import { background } from "@/lib/optional";
import type { RemuxHandle } from "@/lib/media/remux";
import type { MediaSegment, PreparedPlayback, TrickplayInfo } from "@/lib/media/types";
import { EndScreen, type EndInfo } from "./EndScreen";
import { PlayerMenus } from "./PlayerMenus";
import { type EpisodesInfo, type PlayerPanel, type SourcesInfo, useSignedSeconds } from "./player-parts";
// The TV shell's view of the player and its panels. Static: a chunk of its own measured +1.7 KB gzip
// for the site (Turbopack regroups the page's chunks) and +6.7 KB more on the TV.
import { TvChrome } from "./TvChrome";

export interface PlayerEvents {
  onTime: (positionSec: number, durationSec: number | null, paused: boolean) => void;
  onPlay: (positionSec: number) => void;
  onPause: (positionSec: number) => void;
  onEnded: (positionSec: number) => void;
  /** `at`: where the playhead was when it failed (a seek may have moved it since the last `onTime`). */
  onFatal: (message: string, code: number | null, at?: number) => void;
  /** What the line gave this playback (bytes per second, `watchLine`), told once: a file whose size and duration are known. */
  onLine?: (bytesPerSec: number) => void;
}

export interface PlayerProps extends PlayerEvents {
  prepared: PreparedPlayback;
  /**
   * The site's launch (./launch): until the first frame — or a press the browser waits for — the launch's scene covers
   * the player and says what it does; `detail` is a torrent's peers, speed and what is loaded. Not on a TV.
   */
  onLaunch?: (l: { started: boolean; detail: string | null }) => void;
  title: string;
  subtitle: string | null;
  poster: string | null;
  startAt: number;
  /** `startAt` is the profile's saved position (not a source or audio switch): "Start over" is offered for a moment. */
  resumed?: boolean;
  /**
   * Kept while the sources screen is shown over it: paused, out of sight, its keys off; shown again it plays
   * on from where it was, without preparing anything again.
   */
  hidden?: boolean;
  onBack: () => void;
  /** Another audio track, from this position. */
  onAudioChange?: (index: number, positionSec: number) => void;
  /** "Season 1, episode 5 · Pilot", its still (blurred when the profile hides unwatched ones) and the way there. */
  next: { label: string; go: () => void; still?: string | null; blur?: boolean } | null;
  /** Every season's episodes, for the in-player list. */
  episodes?: EpisodesInfo | null;
  /** This title's copies and the search for another (the "Source" panel). */
  sources?: SourcesInfo | null;
  /** What plays, in words: the copy's version and its server. */
  info: { version: string; server: string };
  /** What the end of a film offers; null for an episode with a next one. */
  end?: EndInfo | null;
  /** The title's logo art: the pause and the end screen show it in place of the name. */
  logo?: TitleLogoArt | null;
  /** The title's own language, for naming the original audio track. */
  originalLanguage: string | null;
  /** The title ("movie:603"): the subtitles chosen for it are remembered per profile on this device. */
  titleId?: string;
  footerNote?: ReactNode;
  /**
   * "Watch on TV" in the top corner (the site only): drawn with where the viewing is and its
   * audio track now, and the way to pause it here once the TV has it.
   */
  castButton?: (now: { position: number; audio: number | null; pause: () => void }) => ReactNode;
  /** "Play in another app" in the site's settings menu: this file in an app on this device, from this position. */
  onExternal?: (positionSec: number) => void;
}

const VOLUME_KEY = "lumovio.player.volume";

export function LumovioPlayer(props: PlayerProps) {
  const { prepared } = props;
  const t = useTranslations("player");
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const remux = useRemux(videoRef, prepared, props.startAt, props.onFatal, props.onAudioChange);
  const subtitleMeta = useSubtitles(videoRef, prepared, props.titleId ?? null);
  const look = useSubtitleLook(videoRef, props.titleId ?? null);
  const caps = detectCapabilities();
  const useHlsJs = prepared.type === "hls" && caps.hls === "mse";
  // Text tracks from other origins need CORS mode on the element; only enable it when tracks exist.
  const cors: "anonymous" | undefined = prepared.subtitles.length > 0 ? "anonymous" : undefined;
  const tracks = prepared.subtitles.map((s) => <track key={s.id} kind={s.kind} src={s.url} srcLang={s.lang} label={s.label} />);
  const common = {
    // The letterbox around the frame is the video's own black.
    className: "absolute inset-0 size-full bg-black object-contain",
    playsInline: true,
    autoPlay: true,
    preload: "auto" as const,
    crossOrigin: cors,
    poster: props.poster ?? undefined,
  };

  return (
    // The player's own words (its live announcements, the timeline's value) in the site's language.
    <I18nProvider locale={locale}>
      <VideoPlayer>
        {/* The player is a stage: dark roles in either theme. Kept while hidden, so it goes on where it was. */}
        <Container
          className={clsx("stage group/player fixed inset-0 z-player overflow-hidden bg-black select-none focus:outline-none", props.hidden && "hidden")}
          aria-label={t("playerName", { title: props.title })}
          // Kept out of sight, it is not the page's player: the TV navigation and "Playback info" look for these.
          data-nav-trap={props.hidden ? undefined : true}
          data-player={props.hidden ? undefined : true}
          // The profile's subtitle look for text cues (globals.css).
          data-sub-size={look.style.size}
          data-sub-color={look.style.color}
          data-sub-edge={look.style.edge}
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
          <Chrome {...props} {...(remux ?? {})} subtitleMeta={subtitleMeta} look={look} />
        </Container>
      </VideoPlayer>
    </I18nProvider>
  );
}

/**
 * A file rebuilt in the browser (`lib/media/remux.ts`, loaded only then): the engine owns the
 * element's source, and audio tracks switch in place, at the same position.
 */
function useRemux(ref: RefObject<HTMLVideoElement | null>, prepared: PreparedPlayback, startAt: number, onFatal: PlayerEvents["onFatal"], onOtherTrack: PlayerProps["onAudioChange"]) {
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
          onError: (msg) => fatal.current(msg, null, video.currentTime),
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
    onAudioChange: (index: number, positionSec: number) => {
      const position = prepared.audio.findIndex((a) => a.index === index);
      if (position < 0 || index === audio) return;
      // A track the rebuild can't make (PCM, MP2) is prepared anew, as on a plain stream, which says where it plays —
      // rather than failing the playback, or playing it without sound. The old AVIs' engine decodes those itself.
      const codec = (prepared.audio[position]!.codec ?? "").toLowerCase();
      if (prepared.remuxEngine !== "legacy" && codec && !REMUXABLE_AUDIO.test(codec)) {
        onOtherTrack?.(index, positionSec);
        return;
      }
      setAudio(index);
      handle.current?.selectAudio(position);
    },
  };
}

/** What the player's menu says about a subtitle track beyond its language and name, by the player store's track id. */
export type SubtitleMeta = Map<string, { forced: boolean; format: SubtitleFormat; file: boolean }>;

/** The size changed in the player, per profile, until the session's copy of the profile has it (`useSubtitleLook`). */
const sizeChosen = new Map<string, { before: string; style: SubtitleStyle }>();

/** How subtitles look and when they come, as the player panel changes them. */
export interface SubtitleLook {
  style: SubtitleStyle;
  /** The size from the player: saved to the profile; shown at once, kept for this viewing if saving fails. */
  setSize: (size: SubtitleStyle["size"]) => void;
  /** The profile didn't take the size (the panel says so). */
  sizeFailed: boolean;
  /** Seconds, positive later (`subs/view.ts`); remembered for the title. */
  offset: number;
  setOffset: (seconds: number) => void;
}

/**
 * The profile's subtitle look and this title's timing offset (remembered per profile on this device, like the subtitle
 * choice), handed to every subtitle renderer of the video (`subs/view.ts`) — the browser's cues of a server's subtitle
 * file included, moved as the browser loads them.
 */
function useSubtitleLook(ref: RefObject<HTMLVideoElement | null>, titleId: string | null): SubtitleLook {
  const { me } = useSession();
  const profile = me?.activeProfile ?? null;
  const fromProfile = { ...SUBTITLE_DEFAULTS, ...profile?.subtitleStyle };
  const key = titleId ? `${profile?.id ?? "guest"}:${titleId}` : null;
  const [style, setStyle] = useState<SubtitleStyle>(() => {
    const chosen = profile ? sizeChosen.get(profile.id) : undefined;
    return chosen && chosen.before === JSON.stringify(fromProfile) ? chosen.style : fromProfile;
  });
  const [sizeFailed, setSizeFailed] = useState(false);
  const [offset, setOffsetState] = useState(() => (key ? loadOffset(key) : 0));
  useEffect(() => {
    const video = ref.current;
    if (video) setSubtitleView(video, { style, offset });
  }, [ref, style, offset]);
  // A server's subtitle file (a <track>) is loaded by the browser when it is first shown: its cues move then.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const onLoad = (e: Event) => {
      const track = (e.target as HTMLTrackElement).track;
      shiftTrack(track, subtitleView(video).offset);
    };
    video.addEventListener("load", onLoad, true);
    return () => video.removeEventListener("load", onLoad, true);
  }, [ref]);
  return {
    style,
    sizeFailed,
    setSize: (size) => {
      if (size === style.size) return;
      const next = { ...style, size };
      setStyle(next);
      setSizeFailed(false);
      if (!profile) return;
      sizeChosen.set(profile.id, { before: JSON.stringify(fromProfile), style: next });
      api(`/api/profiles/${profile.id}`, { method: "PATCH", json: { subtitleStyle: next } }).catch(() => {
        sizeChosen.delete(profile.id);
        setSizeFailed(true);
      });
    },
    offset,
    setOffset: (seconds) => {
      setOffsetState(seconds);
      if (key) saveOffset(key, seconds);
    },
  };
}

/**
 * Subtitles the browser can't read itself (`lib/media/subs/engine.ts`, loaded only for a playback that has
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
    // Subtitles are an extra of the stream: when they can't be read, the film plays without them. Their own reading (the
    // file's index at its end, the parts around the playhead) waits for the first frame: until then every byte the torrent
    // brings goes to the picture.
    const start = () =>
      background(
        Promise.all([import("@/lib/media/subs/engine"), import("@/lib/media/subs/choice")]).then(async ([e, c]) => {
          if (abort.signal.aborted) return;
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
    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      video.removeEventListener("loadeddata", begin);
      clearTimeout(late);
      start();
    };
    // A player that never gets its first frame still gets its subtitles in the end.
    const late = setTimeout(begin, 20_000);
    if (video.readyState >= 2) begin();
    else video.addEventListener("loadeddata", begin);
    return () => {
      abort.abort();
      clearTimeout(late);
      video.removeEventListener("loadeddata", begin);
      if (onChange) video.textTracks.removeEventListener("change", onChange);
      engine?.destroy();
      engine = null;
    };
  }, [prepared, ref]);
  return meta;
}

/** One timeline thumbnail cut out of a trickplay sprite sheet, `width` CSS px wide (192 on a TV, 240 on the site). */
function TrickplayThumb({ tp, time, width = 192 }: { tp: TrickplayInfo; time: number; width?: number }) {
  const n = Math.max(0, Math.min(tp.count - 1, Math.floor((time * 1000) / tp.intervalMs)));
  const perSheet = tp.cols * tp.rows;
  const sheet = Math.floor(n / perSheet);
  const i = n % perSheet;
  const scale = width / tp.width;
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

/** What a torrent's server reports while it buffers (peers, speed, loaded), null when it says nothing. */
export type TorrentStats = Awaited<ReturnType<NonNullable<PreparedPlayback["stats"]>>>;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [role="slider"], [tabindex]:not([tabindex="-1"])';
const EDITABLE = /INPUT|TEXTAREA|SELECT/;
/** The next episode's countdown on the site: from the credits (or the last 15 s), 10 s; 5 s once the file has ended. */
const NEXT_IN = 10;
const NEXT_AFTER_END = 5;

/**
 * The player's controls. The state and the keys are one for the site and the TV; the TV shell draws
 * them as it always has (TvChrome), the site as below:
 * - the frame first: "←" alone at the top, everything else in one block at the bottom over one scrim — the title and
 *   episode, the timeline with the time gone at its start and the time left ("−42:10") at its end, the buttons;
 * - paused for a moment, the frame dims and the title's logo, the episode and "42 min left · ends at 22:41" take the
 *   title's place: what this is and how long it still is, for the one who comes back to the screen;
 * - two buttons for the settings of a viewing: "Audio and subtitles" (the most frequent, one press) and "Settings"
 *   (quality, speed, source, playback info, keys — each with its value), menus over the picture (PlayerMenus);
 * - before the first frame only the poster, the loader and the way out; with autoplay refused, one large Play;
 * - every seek, volume step, mute and the subtitles' key said in the middle of the frame for a moment.
 */
function Chrome(props: PlayerProps & { subtitleMeta: SubtitleMeta; look: SubtitleLook }) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const ts = useTranslations("subtitles");
  const locale = useLocale();
  const signedSeconds = useSignedSeconds();
  const store = usePlayer();
  const paused = usePlayer((s) => s.paused);
  const ended = usePlayer((s) => s.ended);
  const waiting = usePlayer((s) => s.waiting);
  const started = usePlayer((s) => s.started);
  const canPlay = usePlayer((s) => s.canPlay);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const buffered = usePlayer((s) => s.buffered);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const rate = usePlayer((s) => s.playbackRate);
  const isFullscreen = usePlayer((s) => s.isFullscreen);
  const error = usePlayer((s) => s.error);
  const controlsVisible = usePlayer((s) => s.controlsVisible);
  const pipAvail = usePlayer((s) => s.pictureInPictureAvailability);
  const isPip = usePlayer((s) => s.isPictureInPicture);
  const castAvail = usePlayer((s) => s.remotePlaybackAvailability);
  const subtitlesShowing = usePlayer((s) => s.subtitlesShowing);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  // "Watch the credits" (or ×): no countdown again until the file ends.
  const [nextDismissed, setNextDismissed] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [panel, setPanel] = useState<PlayerPanel>("none");
  const { tv } = useSession();
  // In the TV shell (tvui): the remote's own model of the player — see the keys below.
  const tvNav = useTvNavOptional();
  const [seekHint, setSeekHint] = useState<{ delta: number; at: number } | null>(null);
  // G / H moved the subtitles: the new offset, said where the eye is for a moment.
  const [offsetHint, setOffsetHint] = useState<number | null>(null);
  // The site's other keys said the same way: a volume step, mute, the subtitles on or off.
  const [noteHint, setNoteHint] = useState<{ icon: LucideIcon; text: string; at: number } | null>(null);
  const hasSubtitles = props.prepared.subtitles.length > 0 || props.subtitleMeta.size > 0;
  const container = useContainer();
  const startedRef = useRef(false);
  const lastTick = useRef(0);
  const segments = props.prepared.segments ?? [];
  const outro = segments.find((s) => s.kind === "outro");
  const hidden = Boolean(props.hidden);
  const anchors = { tracks: useRef<HTMLButtonElement>(null), settings: useRef<HTMLButtonElement>(null), episodes: useRef<HTMLButtonElement>(null) };

  // The keys work at once: the player takes the focus when it opens and when it is shown again; kept out
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
    const seeks = props.prepared.type === "progressive" || props.prepared.seekToStart;
    if (!startedRef.current && duration > 0 && props.startAt > 5 && props.startAt < duration - 10 && seeks) {
      startedRef.current = true;
      void store.seek(props.startAt);
    } else if (duration > 0) startedRef.current = true;
  }, [duration, props.startAt, props.prepared.type, props.prepared.seekToStart, store]);

  // "Start over" once playback has actually landed on the saved position; it goes after 10 s of
  // playback from there, or as soon as the position moves elsewhere.
  const [startOver, setStartOver] = useState<"wait" | "show" | "gone">(props.resumed ? "wait" : "gone");
  useEffect(() => {
    if (startOver === "gone" || !started) return;
    const near = currentTime > props.startAt - 10 && currentTime < props.startAt + 10;
    if (startOver === "wait" && near) setStartOver("show");
    else if (startOver === "show" && !near) setStartOver("gone");
  }, [startOver, started, currentTime, props.startAt]);

  // While a torrent buffers, what its server reports (peers, speed, loaded) — asked only then, 2 s after the last answer:
  // a slow server never has several asks waiting at once.
  const [torrent, setTorrent] = useState<TorrentStats>(null);
  const stats = props.prepared.stats;
  const buffering = (waiting || !started) && !error && !hidden;
  useEffect(() => {
    if (!stats || !buffering) return;
    let live = true;
    let id: number | undefined;
    const tick = () =>
      void stats().then((s) => {
        if (!live) return;
        setTorrent(s);
        id = window.setTimeout(tick, 2000);
      });
    tick();
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [stats, buffering]);

  // Autoplay refused by the browser: the file is ready, nothing plays. After a moment one large Play instead of the
  // loader (the controls appear with the first frame).
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (started || !canPlay || !paused || hidden) {
      setRefused(false);
      return;
    }
    const id = window.setTimeout(() => setRefused(true), 1500);
    return () => window.clearTimeout(id);
  }, [started, canPlay, paused, hidden]);

  // A torrent's peers, speed and what is loaded: under the loader while it waits for data, and on the site's launch
  // scene, which covers the player until its first frame (or the press autoplay waits for) and goes then.
  const torrentLine =
    torrent && (torrent.peers !== null || torrent.speedBps !== null)
      ? [
          torrent.peers !== null ? t("torrentPeers", { count: torrent.peers }) : null,
          torrent.speedBps !== null ? t("torrentSpeed", { speed: formatSize(torrent.speedBps, locale) ?? "0" }) : null,
          torrent.preloadedBytes ? t("torrentLoaded", { size: formatSize(torrent.preloadedBytes, locale) ?? "" }) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;
  const onLaunch = useRef(props.onLaunch);
  onLaunch.current = props.onLaunch;
  useEffect(() => {
    if (!tvNav && !hidden) onLaunch.current?.({ started: started || refused, detail: started ? null : torrentLine });
  }, [tvNav, hidden, started, refused, torrentLine]);

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
    if (error) props.onFatal(error.message, error.code, currentTime);
  }, [error, currentTime, props]);

  // The next episode's card from the credits marker, or near the end; auto-advance after a countdown. The TV keeps its
  // timing (from the last 25 s, 15 s); on the site from the credits or the last 15 s, 10 s — 5 s once the file ended.
  const left = duration > 0 ? duration - currentTime : Number.POSITIVE_INFINITY;
  const inCredits = Boolean(outro && currentTime >= outro.start);
  const [nextTotal, setNextTotal] = useState(NEXT_IN);
  useEffect(() => {
    if (!props.next || hidden || nextCountdown !== null) return;
    if (tvNav) {
      if (ended || (!nextDismissed && (left < 25 || inCredits))) setNextCountdown(ended ? 8 : 15);
      return;
    }
    const n = ended ? NEXT_AFTER_END : !nextDismissed && (left < 15 || inCredits) ? NEXT_IN : null;
    if (n === null) return;
    setNextTotal(n);
    setNextCountdown(n);
  }, [left, ended, inCredits, props.next, nextCountdown, hidden, tvNav, nextDismissed]);
  // An open menu holds the countdown (its card steps aside meanwhile), on the site and on a TV.
  const menuHolds = panel !== "none";
  useEffect(() => {
    if (nextCountdown === null || !props.next || hidden || menuHolds) return;
    if (nextCountdown <= 0) {
      props.next.go();
      return;
    }
    const id = setTimeout(() => setNextCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(id);
  }, [nextCountdown, props.next, hidden, menuHolds]);
  const dismissNext = () => {
    setNextDismissed(true);
    setNextCountdown(null);
  };

  // Skip button for the segment we're in (not for previews / ads, and not when the next-episode card shows).
  const segment: MediaSegment | undefined = segments.find((s) => s.kind !== "preview" && currentTime >= s.start && currentTime < s.end - 1);
  const showSkip = Boolean(segment) && !(segment?.kind === "outro" && props.next && nextCountdown !== null);
  const skip = () => {
    if (!segment) return;
    if (segment.kind === "outro" && props.next) props.next.go();
    else void store.seek(segment.end);
  };

  // The end of a film (or of a series' last episode): its own screen.
  const endShown = ended && !props.next && Boolean(props.end);

  // A panel keeps the controls up: they'd fade after 2 s without movement with the panel still open.
  const layerOpen = panel !== "none";
  useEffect(() => (layerOpen ? store.requestControlsLock() : undefined), [layerOpen, store]);
  // On a TV a panel is a layer of the shell: an entry in the history, so the TV browser's own Back closes the panel and
  // not the player.
  useEffect(() => {
    if (!tvNav || !layerOpen) return;
    const layer = tvNav.openLayer(() => setPanel("none"));
    return () => layer.dismiss();
  }, [tvNav, layerOpen]);
  // The controls the remote is in (the focus on a control) are a step of the history too: Back of a TV browser that
  // keeps Back to itself hides them — the focus back on the picture — before it leaves the player. Hidden by a
  // key or by themselves, they take their entry back.
  const [inControls, setInControls] = useState(false);
  useEffect(() => {
    if (!tvNav || !container) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const a = document.activeElement;
        setInControls(Boolean(a && a !== container && container.contains(a)));
      });
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, [tvNav, container]);
  const hideControls = useRef(() => {});
  hideControls.current = () => {
    store.toggleControls(false);
    container?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!tvNav || !inControls || hidden || endShown) return;
    let own = false;
    const layer = tvNav.openLayer(() => !own && hideControls.current(), { inline: true });
    return () => {
      own = true;
      layer.dismiss();
    };
  }, [tvNav, inControls, hidden, endShown]);
  // The TV app keeps the screen on while a video plays (window.LumovioTV, apps/tv-android), off when it stops.
  useEffect(() => {
    const app = (window as { LumovioTV?: { keepScreenOn?: (on: boolean) => void } }).LumovioTV;
    if (!tvNav || !app?.keepScreenOn) return;
    app.keepScreenOn(started && !paused && !ended);
    return () => app.keepScreenOn?.(false);
  }, [tvNav, started, paused, ended]);
  // The hints fade: a seek after a second, the rest a little later.
  useEffect(() => {
    if (!seekHint) return;
    const id = window.setTimeout(() => setSeekHint(null), 1200);
    return () => window.clearTimeout(id);
  }, [seekHint]);
  useEffect(() => {
    if (offsetHint === null) return;
    const id = window.setTimeout(() => setOffsetHint(null), 1500);
    return () => window.clearTimeout(id);
  }, [offsetHint]);
  useEffect(() => {
    if (!noteHint) return;
    const id = window.setTimeout(() => setNoteHint(null), 1200);
    return () => window.clearTimeout(id);
  }, [noteHint]);

  // The line to the server, as this playback shows it (lib/media/line-speed): told once, for "Auto" to rank releases by.
  const onLine = useRef(props.onLine);
  onLine.current = props.onLine;
  const fileBps = props.prepared.sizeBytes && props.prepared.durationSec ? props.prepared.sizeBytes / props.prepared.durationSec : null;
  useEffect(() => {
    const v = container?.querySelector("video");
    if (!v || !fileBps || !onLine.current) return;
    return watchLine(v, fileBps, (bps) => onLine.current?.(bps));
  }, [container, fileBps]);

  // The site's seeks said in the middle: ±10 by a key, a double tap or the bar's buttons, a few presses summed (the
  // TV's remote sets its own hint below). The timeline's own drag says nothing (its preview shows the time).
  const scrubbing = useRef(false);
  useEffect(() => {
    const v = container?.querySelector("video");
    if (tvNav || !v) return;
    let last = v.currentTime;
    const onTime = () => {
      if (!v.seeking) last = v.currentTime;
    };
    const onSeeking = () => {
      const delta = v.currentTime - last;
      last = v.currentTime;
      if (scrubbing.current || Math.abs(Math.abs(delta) - 10) > 0.75) return;
      const step = delta < 0 ? -10 : 10;
      setSeekHint((h) => ({ delta: (h && Date.now() - h.at < 1200 && Math.sign(h.delta) === Math.sign(step) ? h.delta : 0) + step, at: Date.now() }));
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeeking);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", onSeeking);
    };
  }, [tvNav, container]);
  useEffect(() => {
    if (tvNav) return;
    const up = () => window.setTimeout(() => (scrubbing.current = false), 300);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [tvNav]);

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

  // Paused for a moment (not in a menu, not at the end): the pause's own look on the site.
  const [resting, setResting] = useState(false);
  const restingNow = paused && started && !ended && !layerOpen && !hidden && !tvNav;
  useEffect(() => {
    if (!restingNow) {
      setResting(false);
      return;
    }
    const id = window.setTimeout(() => setResting(true), 2000);
    return () => window.clearTimeout(id);
  }, [restingNow]);

  const togglePlay = () => (paused || ended ? store.play() : store.pause());
  // "Watch on TV": the phone's remote of this viewing on the TV — play/pause and ±10 s, shown on
  // the TV as its own remote's (the controls and the seek's hint). Stopping is the viewing's (WatchView).
  const castControl = useRef<(c: { action: string; delta?: number }) => void>(() => {});
  castControl.current = (c) => {
    store.toggleControls(true);
    if (c.action === "toggle") void togglePlay();
    else if (c.action === "seek" && c.delta) {
      const to = Math.max(0, Math.min(duration > 0 ? duration - 1 : Number.POSITIVE_INFINITY, currentTime + c.delta));
      void store.seek(to);
      const step = c.delta;
      setSeekHint((h) => ({ delta: (h && Date.now() - h.at < 1200 && Math.sign(h.delta) === Math.sign(step) ? h.delta : 0) + step, at: Date.now() }));
    }
  };
  useEffect(() => {
    if (!tvNav || hidden) return;
    const on = (e: Event) => castControl.current((e as CustomEvent<{ action: string; delta?: number }>).detail);
    window.addEventListener("lumovio:cast-control", on);
    return () => window.removeEventListener("lumovio:cast-control", on);
  }, [tvNav, hidden]);
  const percent = new Intl.NumberFormat(locale, { style: "percent" });
  const volumeTo = (v: number) => {
    const to = Math.round(Math.min(1, Math.max(0, v)) * 20) / 20;
    store.setVolume(to);
    if (muted && to > 0) store.setMuted(false);
    setNoteHint({ icon: to === 0 ? VolumeX : to < 0.5 ? Volume1 : Volume2, text: t("volumeHint", { value: percent.format(to) }), at: Date.now() });
  };

  // On the way down, before Radix, the TV navigation and the focused button see it:
  // - Escape (a TV remote's Back) closes one layer and nothing else;
  // - Space always plays or pauses — never "presses" the last button used;
  // - Tab stays inside the player, inside a menu while one is open;
  // - on the site ↑ / ↓ volume, M mute and C subtitles with a hint where the eye is;
  // - S skip · N next episode · I playback info · ? shortcuts · G / H subtitles earlier / later.
  useEffect(() => {
    if (hidden) return;
    const inPlayer = (el: EventTarget | null) => el instanceof Node && Boolean(container?.contains(el));
    const inList = (el: EventTarget | null) => el instanceof Element && Boolean(el.closest('[role="listbox"],[role="menu"]'));
    const stop = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const cycle = (e: KeyboardEvent, scope: Element) => {
      const items = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.getClientRects().length > 0 && !x.closest("[aria-hidden=true],[inert]"));
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i < 0 || i >= items.length - 1 ? 0 : i + 1;
      e.preventDefault();
      items[next]!.focus();
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
      // The remote over the picture: OK plays or pauses, left/right seek with a hint, up/down bring the
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
      // A site menu keeps Tab inside itself; its own rows take the arrows, Space and Enter.
      const menu = !tvNav && layerOpen ? container?.querySelector("[data-player-menu]") : null;
      if (menu && e.key === "Tab") return cycle(e, menu);
      if (layerOpen || endShown) return;
      const el = e.target as HTMLElement | null;
      if (el && EDITABLE.test(el.tagName)) return;
      // A dialog over the player ("Watch on TV") keeps its own keys: Space presses its button, Tab stays in it.
      if (el?.closest('[role="dialog"]')) return;
      if (e.key === " " || e.code === "Space") {
        if (e.repeat) return e.preventDefault();
        e.preventDefault();
        e.stopPropagation();
        store.toggleControls(true);
        void togglePlay();
        return;
      }
      if (e.key === "Tab" && container) {
        store.toggleControls(true);
        cycle(e, container);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // The site's volume, mute and subtitles keys (a TV's are the remote's and the Hotkeys below); a slider in focus
      // keeps its own arrows.
      if (!tvNav && (e.key === "ArrowUp" || e.key === "ArrowDown") && !el?.closest('[role="slider"]')) volumeTo((muted ? 0 : volume) + (e.key === "ArrowUp" ? 0.05 : -0.05));
      else if (!tvNav && (e.key === "m" || e.key === "M")) {
        store.setMuted(!muted);
        if (muted) volumeTo(volume || 0.5);
        else setNoteHint({ icon: VolumeX, text: t("mutedHint"), at: Date.now() });
      } else if (!tvNav && (e.key === "c" || e.key === "C") && hasSubtitles) {
        const on = store.toggleSubtitles();
        setNoteHint({ icon: on ? Captions : CaptionsOff, text: t(on ? "subtitlesOnHint" : "subtitlesOffHint"), at: Date.now() });
      } else if (e.key === "s" || e.key === "S") skip();
      else if ((e.key === "n" || e.key === "N") && props.next) props.next.go();
      else if (e.key === "i" || e.key === "I") setPanel("info");
      else if (e.key === "?") setPanel("help");
      else if (hasSubtitles && (e.key === "g" || e.key === "G" || e.key === "h" || e.key === "H")) {
        const next = stepOffset(props.look.offset, (e.key === "g" || e.key === "G" ? -1 : 1) * OFFSET_STEP);
        props.look.setOffset(next);
        setOffsetHint(next);
      } else {
        // Any other key shows the controls, even when the focus is not on the player.
        if (!inPlayer(e.target)) store.toggleControls(true);
        return;
      }
      e.preventDefault();
    };
    // A button "pressed" by Space on its keyup: the press was the pause above, not a click.
    const up = (e: KeyboardEvent) => {
      if ((e.key === " " || e.code === "Space") && !layerOpen && inPlayer(e.target) && (e.target as HTMLElement).tagName === "BUTTON" && !(e.target as HTMLElement).closest('[role="dialog"]')) e.preventDefault();
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
  // An open menu stands over its button in the bar (on a TV too): the bar stays while it is open.
  const showChrome = (controlsVisible || paused || !started || layerOpen) && !endShown;
  // Text subtitles move up above the controls while they show, and back down when they fade (readable either way) —
  // to the bottom, or two lines higher when the profile puts them "Higher". On the site the block of controls is taller
  // (the title, the timeline, the buttons; the pause's logo): the cues stand as many lines up as it takes.
  const raised = props.look.style.position === "raised";
  const subScale = SUB_SCALE[props.look.style.size] ?? 1;
  const barHeight = useBarHeight(container instanceof HTMLElement ? container : null);
  useEffect(() => {
    const v = container?.querySelector("video");
    if (!v) return;
    // A cue's line is ~4.4 % of the player's height × the profile's size × 1.25 (globals.css `::cue`); line −n stands
    // n − 1 lines above the bottom.
    const lineH = (container instanceof HTMLElement ? container.clientHeight : window.innerHeight) * 0.044 * subScale * 1.25;
    // A player of no height yet (a window minimised or not laid out) would make it −Infinity, which a cue refuses.
    const steps = Math.ceil((barHeight + 12) / lineH) + 1;
    const above = -Math.max(4, Number.isFinite(steps) ? steps : 4);
    const line = showChrome ? (tvNav ? -4 : above) : raised ? -3 : "auto";
    // Subtitles drawn on a canvas over the picture — ASS by libass, PGS pictures — keep their own layout: the layer
    // moves up just as far as the picture's lower edge is under the controls, and back down.
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
    const id = line !== "auto" ? window.setInterval(lift, 2000) : undefined;
    return () => {
      v.textTracks.removeEventListener("change", lift);
      v.textTracks.removeEventListener("addtrack", lift);
      window.clearInterval(id);
    };
  }, [showChrome, raised, container, tvNav, subScale, barHeight]);
  // Faded-out controls take no taps: the first tap on a phone shows them instead of pressing an unseen button.
  const hit = showChrome ? "pointer-events-auto" : "pointer-events-none";
  const tp = props.prepared.trickplay ?? null;
  const onSliderMove = (e: PointerEvent<HTMLElement>) => {
    if (duration <= 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    let f = (e.clientX - r.left) / r.width;
    if (getComputedStyle(e.currentTarget).direction === "rtl") f = 1 - f;
    setHoverTime(Math.max(0, Math.min(1, f)) * duration);
  };
  const off = inputOff;
  const replay = () => {
    void store.seek(0);
    void store.play();
  };
  const panels = {
    panel,
    onPanel: setPanel,
    prepared: props.prepared,
    onAudioChange: props.onAudioChange,
    currentTime,
    episodes: props.episodes ?? null,
    sources: props.sources ?? null,
    info: props.info,
    bufferedAhead,
    originalLanguage: props.originalLanguage,
    hasNext: Boolean(props.next),
    hasSegments: segments.length > 0,
    subtitleMeta: props.subtitleMeta,
    look: props.look,
  };

  const hotkeys = (
    <>
      {/* Space is the handler above; the others listen on the page, so they work before any click. */}
      <Hotkey keys="k" action="togglePaused" target="document" disabled={off} />
      {/* On TV the remote's arrows are handled by spatial navigation (seek only when no control is focused). */}
      {!tv && <Hotkey keys="ArrowLeft" action="seekStep" value={-10} target="document" disabled={off} />}
      {!tv && <Hotkey keys="ArrowRight" action="seekStep" value={10} target="document" disabled={off} />}
      <Hotkey keys="j" action="seekStep" value={-10} target="document" disabled={off} />
      <Hotkey keys="l" action="seekStep" value={10} target="document" disabled={off} />
      {/* The site's ↑ / ↓, M and C are the handler above (with their hints); a TV's M and C stay the Hotkeys. */}
      {tvNav && <Hotkey keys="m" action="toggleMuted" target="document" disabled={off} />}
      <Hotkey keys="f" action="toggleFullscreen" target="document" disabled={off} />
      {tvNav && <Hotkey keys="c" action="toggleSubtitles" target="document" disabled={off || !hasSubtitles} />}
      <Hotkey keys="0-9" action="seekToPercent" target="document" disabled={off} />
      <Gesture type="tap" action="togglePaused" pointer="mouse" disabled={off} />
      <Gesture type="doubletap" action="toggleFullscreen" pointer="mouse" region="center" disabled={off} />
      <Gesture type="doubletap" action="seekStep" value={-10} pointer="touch" region="left" disabled={off} />
      <Gesture type="doubletap" action="seekStep" value={10} pointer="touch" region="right" disabled={off} />
    </>
  );

  if (tvNav)
    return (
      <PortalContainerContext.Provider value={container}>
        <Controls.Root>
          {hotkeys}
          <TvChrome
            props={props}
            showChrome={showChrome}
            hit={hit}
            buffering={buffering}
            bufferedAhead={bufferedAhead}
            torrent={torrent}
            tp={tp}
            hoverTime={hoverTime}
            onSliderMove={onSliderMove}
            onSliderLeave={() => setHoverTime(null)}
            segments={segments}
            segment={segment}
            showSkip={showSkip}
            skip={skip}
            endShown={endShown}
            startOver={startOver}
            onStartOver={() => {
              setStartOver("gone");
              void store.seek(0);
            }}
            nextCountdown={nextCountdown}
            onNextCancel={dismissNext}
            seekHint={seekHint}
            offsetHint={offsetHint}
            togglePlay={togglePlay}
            onPanel={setPanel}
            onReplay={replay}
            Thumb={TrickplayThumb}
            panels={panels}
          />
        </Controls.Root>
      </PortalContainerContext.Provider>
    );

  // The site.
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const known = duration > 0;
  const hint = seekHint
    ? { icon: seekHint.delta < 0 ? RotateCcw : RotateCw, text: t(seekHint.delta < 0 ? "seekBack" : "seekForward", { seconds: Math.abs(seekHint.delta) }) }
    : offsetHint !== null
      ? { icon: Captions, text: ts("timingHint", { value: t("seconds", { value: signedSeconds.format(offsetHint) }) }) }
      : noteHint;
  const corner = cornerBottom(showChrome);
  const leftSec = known ? Math.max(0, duration - currentTime) : 0;

  return (
    // Menus and hints open inside the player: in fullscreen only the player is shown.
    <PortalContainerContext.Provider value={container}>
      <Controls.Root>
        {hotkeys}
        {/* One scrim, at the bottom, under the block of controls; a light one at the top for "←". */}
        <Controls.Backdrop className={clsx("pointer-events-none absolute inset-0 transition-opacity duration-slow", showChrome ? "opacity-100" : "opacity-0")}>
          <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-stage/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-stage/90 via-stage/40 to-transparent" />
        </Controls.Backdrop>
        {/* Paused for a moment, or not yet playing: the whole frame steps back. */}
        <div aria-hidden className={clsx("pointer-events-none absolute inset-0 bg-stage/50 transition-opacity duration-slower ease-slow", resting || !started ? "opacity-100" : "opacity-0")} />

        {/* Before the first frame the site's launch scene covers the player and says it (./launch); the TV's own is TvChrome's. */}
        {buffering && started && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-3 text-center">
              <BrandLoader size="lg" />
              <p className="text-body font-semibold text-text-1">{t("buffering", { percent: Math.min(99, Math.round((bufferedAhead / 10) * 100)) })}</p>
              {torrentLine && <p className="text-body-s text-text-2 tabular-nums">{torrentLine}</p>}
            </div>
          </div>
        )}

        {/* Autoplay refused: the one thing to do, large, in the middle. */}
        {refused && !started && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <IconButton icon={Play} label={t("play")} variant="stage" size="lg" className={clsx("pointer-events-auto", BIG_PLAY)} onClick={() => void store.play()} />
          </div>
        )}

        {/* Touch screens: back, play and forward in the middle, as streaming apps; Play the large one. */}
        {started && (
          <div className={clsx("pointer-events-none absolute inset-0 hidden items-center justify-center gap-12 transition-opacity duration-slow pointer-coarse:flex", showChrome ? "opacity-100" : "opacity-0")}>
            <IconButton icon={RotateCcw} label={t("back10")} variant="stage" size="lg" className={hit} onClick={() => void store.seek(Math.max(0, currentTime - 10))} />
            <IconButton icon={paused ? Play : Pause} label={paused ? t("play") : t("pause")} variant="stage" size="lg" className={clsx(hit, BIG_PLAY)} onClick={() => void togglePlay()} />
            <IconButton icon={RotateCw} label={t("forward10")} variant="stage" size="lg" className={hit} onClick={() => void store.seek(currentTime + 10)} />
          </div>
        )}

        <Controls.Content className={clsx("pointer-events-none absolute inset-0 transition-opacity duration-slow", showChrome ? "opacity-100" : "opacity-0")}>
          <Controls.Group className={clsx(hit, "absolute start-4 top-[max(1rem,env(safe-area-inset-top))] md:start-8 md:top-8")}>
            <IconButton icon={ArrowLeft} label={tc("back")} variant="stage" size="lg" onClick={props.onBack} className="[&_svg]:rtl:-scale-x-100" />
          </Controls.Group>
          {/* "Watch on TV" at the top end, where streaming apps keep it (YouTube, Netflix): the bar stays as it is. */}
          {props.castButton && started && (
            <Controls.Group className={clsx(hit, "absolute end-4 top-[max(1rem,env(safe-area-inset-top))] md:end-8 md:top-8")}>
              {props.castButton({ position: currentTime, audio: props.prepared.audio.find((a) => a.isDefault)?.index ?? null, pause: () => void store.pause() })}
            </Controls.Group>
          )}

          <Controls.Group data-player-bar className={clsx(hit, "absolute inset-x-0 bottom-0 flex flex-col gap-1 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:gap-2 md:px-10 md:pb-6")}>
            {props.footerNote}
            <TitleLine
              title={props.title}
              subtitle={props.subtitle}
              logo={props.logo ?? null}
              resting={resting}
              left={known && resting ? t("pauseLeft", { left: formatRuntime(Math.max(1, Math.ceil(leftSec / 60)), (k, v) => tc(k.replace("common.", "") as "minutes", v)) ?? "", at: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(Date.now() + (leftSec * 1000) / (rate || 1)) }) : null}
            />
            {started && (
              <div className="flex items-center gap-3 md:gap-4">
                <span className="min-w-10 text-body-s font-semibold text-text-1 tabular-nums">{known ? formatClock(currentTime) : "--:--"}</span>
                <TimeSlider.Root
                  className="group/ts relative flex h-8 min-w-0 flex-1 cursor-pointer touch-none items-center rounded-full focus-visible:outline-none"
                  label={t("timeline")}
                  onPointerDown={() => (scrubbing.current = true)}
                  onPointerMove={onSliderMove}
                  onPointerLeave={() => setHoverTime(null)}
                >
                  <TimeSlider.Track className="relative h-1 w-full overflow-hidden rounded-full bg-text-1/25 transition-[height] duration-fast ease-fast group-hover/ts:h-1.5 group-focus-within/ts:h-1.5">
                    <TimeSlider.Buffer className="absolute inset-y-0 start-0 w-(--media-slider-buffer) bg-text-1/35" />
                    <TimeSlider.Fill className="absolute inset-y-0 start-0 w-(--media-slider-fill) bg-progress" />
                  </TimeSlider.Track>
                  {/* The intro and the credits as cuts in the line (where they start and end), not as another fill. */}
                  {known &&
                    segments
                      .filter((s) => s.kind !== "preview")
                      .flatMap((s) => [s.start, s.end])
                      .filter((at) => at > 1 && at < duration - 1)
                      .map((at) => <span key={at} aria-hidden className="pointer-events-none absolute top-1/2 h-2 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-stage rtl:translate-x-1/2" style={{ insetInlineStart: `${(at / duration) * 100}%` }} />)}
                  {/* The knob is the slider's focus stop: it shows, with the focus ring, while it has the keyboard's focus. */}
                  <TimeSlider.Thumb className="absolute start-(--media-slider-fill) size-4 -translate-x-1/2 scale-0 rounded-full bg-text-1 transition-transform duration-fast ease-fast group-hover/ts:scale-100 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus focus-visible:shadow-(--focus-halo) rtl:translate-x-1/2" />
                  {/* Placed by Vidstack itself (its inline `left`: the pointer less half its width, kept inside the bar): no shift of
                      its own, or the time stands half its width beside the pointer. */}
                  <TimeSlider.Preview className="pointer-events-none absolute bottom-10 flex flex-col items-center opacity-0 group-hover/ts:opacity-100">
                    {tp && hoverTime !== null && <TrickplayThumb tp={tp} time={hoverTime} width={240} />}
                    <span className="rounded-xs bg-stage/85 px-2 py-1 text-body-s font-semibold tabular-nums">
                      <TimeSlider.Value type="pointer" />
                    </span>
                  </TimeSlider.Preview>
                </TimeSlider.Root>
                <span className="min-w-10 text-end text-body-s font-semibold text-text-2 tabular-nums">{known ? `−${formatClock(leftSec)}` : ""}</span>
              </div>
            )}
            {started && (
              <div className="flex items-center gap-1 md:gap-2">
                <span className="contents pointer-coarse:hidden">
                  <Control icon={paused ? Play : Pause} filled label={paused ? t("play") : t("pause")} onClick={togglePlay} />
                  <Control icon={RotateCcw} label={t("back10")} onClick={() => store.seek(Math.max(0, currentTime - 10))} />
                  <Control icon={RotateCw} label={t("forward10")} onClick={() => store.seek(currentTime + 10)} />
                </span>
                {/* Volume with a mouse: the button always, its slider on a wide screen, by focus or hover below.
                    On touch screens the device's own buttons set it. */}
                <div className="group/vol hidden items-center gap-1 pointer-fine:flex">
                  <Control icon={VolIcon} label={muted ? t("unmute") : t("mute")} onClick={() => store.setMuted(!muted)} />
                  <div className="w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-base ease-base group-hover/vol:w-24 group-hover/vol:opacity-100 focus-within:w-24 focus-within:opacity-100 lg:w-24 lg:opacity-100">
                    <Slider
                      variant="player"
                      label={tc("volume")}
                      valueText={percent.format(muted ? 0 : volume)}
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

                <div className="ms-auto flex items-center gap-1 md:gap-2">
                  {props.next && <Control icon={SkipForward} label={t("nextEpisode")} onClick={props.next.go} />}
                  {props.episodes && <Control ref={anchors.episodes} icon={ListVideo} label={t("episodes")} pressed={panel === "episodes"} onClick={() => setPanel((p) => (p === "episodes" ? "none" : "episodes"))} />}
                  {/* Always there, with one track or none too: the menu says what the file has; a dot while subtitles show. */}
                  <span className="relative inline-flex">
                    <Control ref={anchors.tracks} icon={Captions} label={t("audioAndSubtitles")} pressed={panel === "tracks"} onClick={() => setPanel((p) => (p === "tracks" ? "none" : "tracks"))} />
                    {subtitlesShowing && panel !== "tracks" && <span aria-hidden className="pointer-events-none absolute end-2 top-2 size-2 rounded-full bg-accent" />}
                  </span>
                  <Control
                    ref={anchors.settings}
                    icon={Settings}
                    label={t("settings")}
                    pressed={panel === "settings" || panel === "info" || panel === "source" || panel === "help"}
                    onClick={() => setPanel((p) => (p === "none" || p === "tracks" || p === "episodes" ? "settings" : "none"))}
                  />
                  {pipAvail === "available" && <Control icon={PictureInPicture2} label={isPip ? t("exitPip") : t("pip")} onClick={() => (isPip ? store.exitPictureInPicture() : store.requestPictureInPicture())} />}
                  {castAvail === "available" && <Control icon={Cast} label={t("cast")} onClick={() => store.promptRemotePlayback()} />}
                  <Control icon={isFullscreen ? Minimize : Maximize} label={isFullscreen ? t("exitFullscreen") : t("fullscreen")} onClick={() => (isFullscreen ? store.exitFullscreen() : fullscreen(() => store.requestFullscreen()))} />
                </div>
              </div>
            )}
          </Controls.Group>
        </Controls.Content>

        {hint && (
          // A key's or a double tap's result, said where the eye is.
          // (On a touch screen above the middle, where back / play / forward stand.)
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/2 grid -translate-y-1/2 place-items-center pointer-coarse:top-1/4">
            <span className="flex items-center gap-2 rounded-full bg-stage/80 px-5 py-2.5 text-h3 font-semibold text-text-1 tabular-nums md:gap-3 md:px-6 md:py-3 md:text-h2">
              <hint.icon aria-hidden className="size-6 md:size-8" />
              {hint.text}
            </span>
          </div>
        )}

        {showSkip && segment && !endShown && !layerOpen && (
          <Button variant="secondary" size="lg" icon={FastForward} onClick={skip} className={CORNER} style={corner}>
            {segment.kind === "intro" ? t("skipIntro") : segment.kind === "recap" ? t("skipRecap") : segment.kind === "outro" && props.next ? t("nextEpisode") : t("skipCredits")}
          </Button>
        )}

        {startOver === "show" && !showSkip && nextCountdown === null && !layerOpen && (
          <Button
            variant="secondary"
            size="lg"
            icon={SkipBack}
            onClick={() => {
              setStartOver("gone");
              void store.seek(0);
            }}
            className={CORNER}
            style={corner}
          >
            {t("startOver")}
          </Button>
        )}

        {props.next && nextCountdown !== null && !hidden && !layerOpen && (
          <NextCard next={props.next} seconds={nextCountdown} total={nextTotal} ended={ended} onDismiss={dismissNext} style={corner} />
        )}

        {endShown && props.end && <EndScreen end={props.end} title={props.title} logo={props.logo ?? null} backdrop={props.poster} onReplay={replay} onBack={props.onBack} />}

        <PlayerMenus {...panels} anchors={anchors} onExternal={props.onExternal} />
      </Controls.Root>
    </PortalContainerContext.Provider>
  );
}

/** The profile's subtitle sizes as globals.css scales them (`--sub-scale`). */
const SUB_SCALE: Record<string, number> = { s: 0.8, m: 1, l: 1.25, xl: 1.5 };

/** Play in the middle, larger than the rest (72 against 48: the main action shows by its size). */
const BIG_PLAY = "size-18 [&_svg]:size-9 [&_svg]:fill-current [&>span]:size-18";

/** The skip / start-over buttons and the next episode's card: above the block of controls, lower when it fades. */
const CORNER = "pointer-events-auto absolute end-4 z-10 animate-fade-up transition-[bottom] duration-slow ease-slow md:end-10";
function cornerBottom(chrome: boolean) {
  // The block's height is measured once by CSS: `--player-bar` on the player (globals.css), set by ResizeObserver below.
  return { bottom: chrome ? "calc(var(--player-bar, 9rem) + 0.75rem)" : "max(1.5rem, env(safe-area-inset-bottom))" };
}

/**
 * Full screen on a phone held upright turns it sideways (where the browser lets a page lock the orientation: Android;
 * an iPhone plays full screen in its own player).
 */
function fullscreen(request: () => Promise<void>) {
  background(
    request().then(() => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: "landscape") => Promise<void> };
      if (window.matchMedia("(pointer: coarse) and (orientation: portrait)").matches && o?.lock) return o.lock("landscape");
    }),
  );
}

/**
 * The title's line over the timeline; paused for a moment, the pause's own look in the same place: the logo (or the
 * name, larger), the episode, and how long is left with the time it ends.
 */
function TitleLine({ title, subtitle, logo, resting, left }: { title: string; subtitle: string | null; logo: TitleLogoArt | null; resting: boolean; left: string | null }) {
  return (
    <div className="mb-1 flex min-w-0 flex-col items-start gap-1 md:mb-2">
      {resting && logo ? (
        <TitleLogo logo={logo} alt={title} className="mb-1 max-w-[min(70vw,24rem)] animate-fade-up [--logo-h:3.5rem] md:[--logo-h:6rem]">
          <p className="max-w-full truncate text-h2 md:text-h1">{title}</p>
        </TitleLogo>
      ) : (
        <p className={cn("max-w-full truncate text-text-1 transition-[font-size] duration-base", resting ? "text-h2 md:text-h1" : "text-title md:text-h3")}>{title}</p>
      )}
      {subtitle && <p className={cn("max-w-full truncate font-medium text-text-2", resting ? "text-body md:text-title" : "text-body-s md:text-body")}>{subtitle}</p>}
      {left && <p className="animate-fade-up text-body-s text-text-2 tabular-nums md:text-body">{left}</p>}
    </div>
  );
}

/**
 * The next episode after the credits begin (or near the end): its still (blurred when the profile hides unwatched
 * ones), its name, "Play now" filling up as the countdown runs, "Watch the credits" to stay. Said once to a reader.
 */
function NextCard({ next, seconds, total, ended, onDismiss, style }: { next: NonNullable<PlayerProps["next"]>; seconds: number; total: number; ended: boolean; onDismiss: () => void; style: CSSProperties }) {
  const t = useTranslations("player");
  const go = useRef<HTMLButtonElement>(null);
  // At the very end the card is the screen's one action: the focus on it (Enter plays the next one).
  useEffect(() => {
    if (ended) go.current?.focus({ preventScroll: true });
  }, [ended]);
  return (
    <section
      aria-label={t("nextEpisode")}
      data-interactive
      className="pointer-events-auto absolute end-4 z-10 w-80 max-w-[calc(100%-2rem)] animate-fade-up overflow-hidden rounded-lg border border-line bg-surface-1/95 shadow-float transition-[bottom] duration-slow ease-slow md:end-10 md:w-88"
      style={style}
    >
      {next.still && (
        <div className="relative aspect-video overflow-hidden bg-surface-2">
          <img src={next.still} alt="" className={cn("size-full object-cover", next.blur && "scale-110 blur-lg")} />
        </div>
      )}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-body-s font-semibold text-text-2" aria-hidden>
            {t("nextIn", { seconds })}
          </p>
          <p className="sr-only" role="status">
            {t("nextIn", { seconds: total })}
          </p>
          <p className="mt-1 line-clamp-2 text-title text-text-1">{next.label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button ref={go} onClick={next.go} className="grow overflow-hidden">
            {/* The countdown as a fill under the words (a shade of the button's own colours); per second with reduced motion. */}
            <span aria-hidden key={total} data-countdown className="absolute inset-y-0 start-0 bg-bg/15" style={{ animationDuration: `${total}s`, width: `${((total - seconds) / total) * 100}%` }} />
            <span className="relative inline-flex items-center gap-2">
              <Play aria-hidden className="size-5 fill-current" />
              {t("playNow")}
            </span>
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            {t("watchCredits")}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** A control of the bar: IconButton `stage` 48, the play icon filled; `pressed` while its menu is open. */
function Control({ icon, label, onClick, filled, pressed, ref }: { icon: LucideIcon; label: string; onClick: () => unknown; filled?: boolean; pressed?: boolean; ref?: RefObject<HTMLButtonElement | null> }) {
  return (
    <IconButton
      ref={ref}
      icon={icon}
      label={label}
      variant="stage"
      size="lg"
      aria-expanded={pressed}
      onClick={() => void onClick()}
      className={filled ? "[&_svg]:fill-current" : undefined}
    />
  );
}

/**
 * Keeps `--player-bar` on the player — the height of its block of controls, which the corner's buttons stand above —
 * and gives it to the subtitles' lift.
 */
function useBarHeight(container: HTMLElement | null) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const bar = container?.querySelector<HTMLElement>("[data-player-bar]");
    if (!container || !bar || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const h = Math.round(bar.offsetHeight);
      container.style.setProperty("--player-bar", `${h}px`);
      setHeight(h);
    });
    ro.observe(bar);
    return () => ro.disconnect();
  }, [container]);
  return height;
}
