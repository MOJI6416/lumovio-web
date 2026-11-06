"use client";

import type { SubtitleStyle } from "@lumovio/contracts";
import { usePlayer } from "@videojs/react/video";
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { ServerMark } from "@/components/connections/ServerMark";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Sheet } from "@/components/ui/Dialog";
import { usePhoneLayout } from "@/components/ui/layers";
import { OFFSET_STEP, stepOffset } from "@/lib/media/subs/view";
import type { PreparedPlayback } from "@/lib/media/types";
import type { SubtitleLook, SubtitleMeta } from "./LumovioPlayer";
import { type EpisodesInfo, EpisodesBody, FORMAT_NAME, focusChoice, InfoBody, type PlayerPanel, ShortcutRows, type SourcesInfo, Surface, useSignedSeconds, useTrackWords } from "./player-parts";

/** The buttons the menus stand over (and give the focus back to). */
export interface MenuAnchors {
  tracks: RefObject<HTMLButtonElement | null>;
  settings: RefObject<HTMLButtonElement | null>;
  episodes: RefObject<HTMLButtonElement | null>;
}

type Level = "root" | "quality" | "speed" | "source" | "info" | "keys";
const LEVEL_OF: Partial<Record<PlayerPanel, Level>> = { settings: "root", info: "info", source: "source", help: "keys" };

/**
 * The site's player menus (design-system 11.1): "Audio and subtitles" — the most frequent, one press, the two lists side
 * by side — "Settings" — one root with each setting's current value, a level per setting ("‹" back) — and the episodes.
 * On a computer a surface over the picture above its button, no veil: the film stays in view and plays on; closed by
 * Escape, a press outside or the button again (the surface is player-parts' Surface, the TV's menus stand on it too).
 * On a phone a bottom sheet, as every menu of the site (7.9). The TV keeps its own lists (PlayerPanels, TV document §6).
 */
export function PlayerMenus({
  panel,
  onPanel,
  anchors,
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
  anchors: MenuAnchors;
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
  subtitleMeta: SubtitleMeta;
  look: SubtitleLook;
}) {
  const t = useTranslations("player");
  const phone = usePhoneLayout();
  const close = () => onPanel("none");
  const settingsLevel = LEVEL_OF[panel];
  const [level, setLevel] = useState<Level>("root");
  // "I" opens the playback info and "?" the keys: the settings at that level.
  useEffect(() => {
    if (settingsLevel) setLevel(settingsLevel);
  }, [settingsLevel]);
  const layer = (open: boolean, title: string, anchor: RefObject<HTMLButtonElement | null>, width: string, body: ReactNode) =>
    phone ? (
      <Sheet open={open} onOpenChange={(o) => !o && close()} title={title}>
        {body}
      </Sheet>
    ) : open ? (
      <Surface anchor={anchor} label={title} onClose={close} className={width}>
        {body}
      </Surface>
    ) : null;
  return (
    <>
      {layer(
        panel === "tracks",
        t("audioAndSubtitles"),
        anchors.tracks,
        "w-144",
        <TracksMenu prepared={prepared} onAudioChange={onAudioChange} currentTime={currentTime} originalLanguage={originalLanguage} subtitleMeta={subtitleMeta} look={look} columns={!phone} />,
      )}
      {layer(
        Boolean(settingsLevel),
        t("settings"),
        anchors.settings,
        level === "keys" || level === "info" || level === "source" ? "w-100" : "w-90",
        <SettingsMenu
          level={level}
          onLevel={setLevel}
          prepared={prepared}
          info={info}
          bufferedAhead={bufferedAhead}
          sources={sources}
          hasNext={hasNext}
          hasSegments={hasSegments}
          subtitles={prepared.subtitles.length > 0 || subtitleMeta.size > 0}
          onPickSource={(key) => {
            close();
            sources?.onPick(key, currentTime);
          }}
          onSearch={
            sources?.onSearch &&
            (() => {
              close();
              sources.onSearch?.(currentTime);
            })
          }
        />,
      )}
      {episodes &&
        layer(panel === "episodes", t("episodes"), anchors.episodes, "w-120", <EpisodesBody episodes={episodes} onPick={close} />)}
    </>
  );
}

/** Moves the focus into a level when it replaces the list (`key`: the level); the surface focuses on open itself. */
function useLevelFocus(ref: RefObject<HTMLElement | null>, key: unknown) {
  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the level is the trigger, the ref is stable
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    focusChoice(ref.current);
  }, [key]);
}

/** A note in a menu: what the file has, or why something can't be chosen here. */
function Note({ children }: { children: ReactNode }) {
  return <p className="px-3 py-2 text-body-s text-text-2">{children}</p>;
}

function Heading({ children }: { children: ReactNode }) {
  return <p className="px-3 pt-2 pb-1 text-body-s font-semibold text-text-2">{children}</p>;
}

const ROW =
  "flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-2 text-start text-body text-text-1 transition-colors duration-fast ease-fast hover:not-disabled:bg-surface-2 focus-visible:bg-surface-3 focus-visible:outline-none disabled:opacity-40";

/** One choice of a list: its words, a format or fact under them, a check at the end on the chosen one. */
function Choice({ checked, label, description, icon, badge, disabled, onSelect }: { checked: boolean; label: ReactNode; description?: string; icon?: ReactNode; badge?: ReactNode; disabled?: boolean; onSelect: () => void }) {
  return (
    <button /* ui-lint-ignore raw-button: a choice row of the player's menu (11.1), a menuitemradio */
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      data-menu-row
      disabled={disabled}
      onClick={() => !checked && onSelect()}
      className={ROW}
    >
      {icon}
      <span className="min-w-0 flex-1">
        {badge}
        <span className="block break-words">{label}</span>
        {description && <span className="block text-body-s text-text-2">{description}</span>}
      </span>
      <Check aria-hidden className={cn("size-5 shrink-0 text-progress", !checked && "invisible")} />
    </button>
  );
}

/** A list of choices under its heading (a menu of menuitemradio rows). */
function Choices({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="menu" aria-label={label} className="flex flex-col">
      {children}
    </div>
  );
}

/** A row of the settings root: the setting and its current value; a chevron when it opens a level. */
function SettingRow({ label, value, onOpen }: { label: string; value?: string; onOpen?: () => void }) {
  if (!onOpen)
    return (
      <div className="flex min-h-11 items-center gap-3 px-3 py-2 text-body">
        <span className="flex-1">{label}</span>
        <span className="text-text-2">{value}</span>
      </div>
    );
  return (
    <button /* ui-lint-ignore raw-button: a row of the player's settings menu (11.1) that opens its level */
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      data-menu-row
      onClick={onOpen}
      className={ROW}
    >
      <span className="flex-1">{label}</span>
      {value && <span className="max-w-1/2 truncate text-text-2">{value}</span>}
      <ChevronRight aria-hidden className="size-5 shrink-0 text-text-2 rtl:-scale-x-100" />
    </button>
  );
}

/** The header of a level: its name, and back to where it opened from ("‹ Speed"). */
function LevelBack({ label, onBack }: { label: string; onBack: () => void }) {
  const tc = useTranslations("common");
  return (
    <Button variant="tertiary" size="sm" icon={ChevronLeft} aria-label={`${tc("back")}: ${label}`} onClick={onBack} className="mb-1 [&_svg]:rtl:-scale-x-100">
      {label}
    </Button>
  );
}

/**
 * Audio and subtitles (PLR-07): every track in words — "Russian · dubbed (Pifagor)" — with its format under it, the one
 * playing checked; none or one is said so. Two columns on a computer, one under the other on a phone. Under the
 * subtitles: their size (the profile's; a level of its own) and timing for this title ("Earlier" · "+1.0 s" · "Later").
 */
function TracksMenu({
  prepared,
  onAudioChange,
  currentTime,
  originalLanguage,
  subtitleMeta,
  look,
  columns,
}: {
  prepared: PreparedPlayback;
  onAudioChange?: (index: number, positionSec: number) => void;
  currentTime: number;
  originalLanguage: string | null;
  subtitleMeta: SubtitleMeta;
  look: SubtitleLook;
  columns: boolean;
}) {
  const t = useTranslations("player");
  const ts = useTranslations("subtitles");
  const store = usePlayer();
  const audioTracks = usePlayer((s) => s.audioTrackList);
  const textTracks = usePlayer((s) => s.textTrackList);
  const subtitlesShowing = usePlayer((s) => s.subtitlesShowing);
  const words = useTrackWords(originalLanguage);
  // A subtitle track in a language is that language's subtitles, never "the original" of the audio.
  const subWords = useTrackWords(null);
  const [sizes, setSizes] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useLevelFocus(root, sizes);
  const subtitleTracks = textTracks.filter((tr) => tr.kind === "subtitles" || tr.kind === "captions");
  // HLS gives its own audio list; a file gives the server's (switched by preparing it again, or in place when rebuilt).
  const hls = audioTracks.length > 1;
  const audio = hls
    ? audioTracks.map((a) => ({ value: a.id, label: words(a.label || null, a.language || null), description: undefined as string | undefined, checked: a.enabled }))
    : prepared.audio.map((a, i) => ({ value: String(a.index), label: words(a.label, a.lang, i + 1), description: a.codec?.toUpperCase(), checked: a.isDefault }));
  const canSwitch = hls || Boolean(onAudioChange);
  const shown = subtitlesShowing ? subtitleTracks.find((tr) => tr.mode === "showing") : undefined;
  return (
    <div ref={root} className={cn("grid gap-2", columns && "grid-cols-2")}>
      <section aria-label={t("audio")} className="min-w-0">
        <Heading>{t("audio")}</Heading>
        {audio.length === 0 ? (
          <Note>{t("audioUnknown")}</Note>
        ) : (
          <Choices label={t("audio")}>
            {audio.map((a) => (
              <Choice
                key={a.value}
                checked={a.checked}
                label={a.label}
                description={a.description}
                disabled={!canSwitch && !a.checked}
                onSelect={() => (hls ? store.selectAudioTrack(a.value) : onAudioChange?.(Number(a.value), currentTime))}
              />
            ))}
          </Choices>
        )}
        {audio.length > 1 && !canSwitch && <Note>{t("audioNoSwitch")}</Note>}
      </section>
      <section aria-label={t("subtitles")} className={cn("min-w-0", columns && "border-s border-line ps-2")}>
        {sizes ? (
          <>
            <LevelBack label={ts("sizePlayer")} onBack={() => setSizes(false)} />
            <Choices label={ts("sizePlayer")}>
              {(["s", "m", "l", "xl"] as const).map((v) => (
                <Choice key={v} checked={look.style.size === v} label={ts(`size_${v}`)} onSelect={() => look.setSize(v as SubtitleStyle["size"])} />
              ))}
            </Choices>
            {look.sizeFailed && <Note>{ts("sizeFailed")}</Note>}
          </>
        ) : (
          <>
            <Heading>{t("subtitles")}</Heading>
            {subtitleTracks.length === 0 ? (
              <Note>{t("subtitlesNone")}</Note>
            ) : (
              <>
                <Choices label={t("subtitles")}>
                  <Choice checked={!shown} label={t("subtitlesOff")} onSelect={() => store.selectSubtitlesTrack(null)} />
                  {subtitleTracks.map((tr, i) => {
                    // The file's own tracks and the torrent's files (PLR-14): forced ones said so, the format underneath.
                    const m = subtitleMeta.get(tr.id);
                    const w = subWords(tr.label || null, tr.language || null, i + 1);
                    return (
                      <Choice
                        key={tr.id}
                        checked={shown?.id === tr.id}
                        // "Forced" said once: not again after a track already named "Надписи".
                        label={m?.forced && !w.toLowerCase().includes(t("subtitlesForced").toLowerCase()) ? `${w} · ${t("subtitlesForced")}` : w}
                        description={m ? [FORMAT_NAME[m.format], m.file ? t("subtitlesFile") : null].filter(Boolean).join(" · ") : undefined}
                        onSelect={() => store.selectSubtitlesTrack(tr.id)}
                      />
                    );
                  })}
                </Choices>
                <hr className="mx-3 my-2 h-px border-0 bg-line" />
                <div role="menu" aria-label={ts("sizePlayer")}>
                  <SettingRow label={ts("sizePlayer")} value={ts(`size_${look.style.size}`)} onOpen={() => setSizes(true)} />
                </div>
                <Timing look={look} />
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** The subtitles' timing for this title, half a second a press (G / H on a keyboard), "Reset" while it isn't zero. */
function Timing({ look }: { look: SubtitleLook }) {
  const t = useTranslations("player");
  const ts = useTranslations("subtitles");
  const signed = useSignedSeconds();
  const later = useRef<HTMLButtonElement>(null);
  return (
    <section aria-label={ts("timing")} className="flex flex-col gap-2 px-3 py-2">
      <p className="text-body text-text-1">{ts("timing")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => look.setOffset(stepOffset(look.offset, -OFFSET_STEP))}>
          {ts("earlier")}
        </Button>
        <output aria-live="polite" className="min-w-14 text-center text-body font-semibold tabular-nums">
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
              // "Reset" goes with the offset: the focus stays in the row.
              later.current?.focus();
            }}
          >
            {ts("reset")}
          </Button>
        )}
      </div>
    </section>
  );
}

/**
 * Settings: one root with each setting's value (as YouTube's), a level per setting replacing the list. Quality — the
 * stream's real versions (one file is one quality: its height, no level); speed; the source — this title's other copies
 * from this position and the search for another (PLR-03); playback info (PLR-06); the keys (a computer only).
 */
function SettingsMenu(props: Parameters<typeof SettingsLevel>[0]) {
  const root = useRef<HTMLDivElement>(null);
  useLevelFocus(root, props.level);
  return (
    <div ref={root}>
      <SettingsLevel {...props} />
    </div>
  );
}

function SettingsLevel({
  level,
  onLevel,
  prepared,
  info,
  bufferedAhead,
  sources,
  hasNext,
  hasSegments,
  subtitles,
  onPickSource,
  onSearch,
}: {
  level: Level;
  onLevel: (l: Level) => void;
  prepared: PreparedPlayback;
  info: { version: string; server: string };
  bufferedAhead: number;
  sources: SourcesInfo | null;
  hasNext: boolean;
  hasSegments: boolean;
  subtitles: boolean;
  onPickSource: (key: string) => void;
  onSearch?: () => void;
}) {
  const t = useTranslations("player");
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const store = usePlayer();
  const renditions = usePlayer((s) => s.videoRenditionList);
  const active = usePlayer((s) => s.activeVideoRendition);
  const rate = usePlayer((s) => s.playbackRate);
  const [height, setHeight] = useState(0);
  useEffect(() => setHeight(document.querySelector<HTMLVideoElement>("[data-player] video")?.videoHeight ?? 0), []);
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const speedName = (r: number) => (r === 1 ? t("normal") : `${number.format(r)}×`);
  const selected = renditions.find((r) => r.selected);
  const quality = renditions.length > 1 ? (selected?.height ? `${selected.height}p` : active?.height ? t("autoWith", { height: active.height }) : t("auto")) : height ? `${height}p` : null;
  const current = sources?.list.find((s) => s.current);
  const back = (label: string) => <LevelBack label={label} onBack={() => onLevel("root")} />;
  if (level === "quality")
    return (
      <>
        {back(t("quality"))}
        <Choices label={t("quality")}>
          <Choice checked={!selected} label={active?.height ? t("autoWith", { height: active.height }) : t("auto")} onSelect={() => store.selectVideoRendition("auto")} />
          {[...renditions]
            .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
            .map((r) => (
              <Choice
                key={r.id}
                checked={selected?.id === r.id}
                label={r.height ? `${r.height}p` : t("qualityUnnamed")}
                description={r.bitrate ? t("bitrate", { value: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(r.bitrate / 1e6) }) : undefined}
                onSelect={() => {
                  store.selectVideoRendition(r.id);
                  onLevel("root");
                }}
              />
            ))}
        </Choices>
      </>
    );
  if (level === "speed")
    return (
      <>
        {back(t("speed"))}
        <Choices label={t("speed")}>
          {[0.75, 1, 1.25, 1.5, 2].map((r) => (
            <Choice
              key={r}
              checked={rate === r}
              label={speedName(r)}
              onSelect={() => {
                store.setPlaybackRate(r);
                onLevel("root");
              }}
            />
          ))}
        </Choices>
      </>
    );
  if (level === "source" && sources)
    return (
      <>
        {back(t("source"))}
        <Choices label={t("source")}>
          {sources.list.map((s) => (
            <Choice
              key={s.key}
              checked={s.current}
              icon={<ServerMark kind={s.kind} />}
              badge={s.failed && !s.current ? <Tag className="mb-1">{t("failedSource")}</Tag> : undefined}
              label={s.title}
              description={s.meta}
              onSelect={() => onPickSource(s.key)}
            />
          ))}
        </Choices>
        {onSearch && (
          <Button variant="secondary" icon={Search} onClick={onSearch} className="mx-1 mt-2 mb-1 w-[calc(100%-0.5rem)]">
            {t("findAnother")}
          </Button>
        )}
      </>
    );
  if (level === "info")
    return (
      <>
        {back(t("playbackInfo"))}
        <div className="px-3 pt-1 pb-2">
          <InfoBody prepared={prepared} info={info} bufferedAhead={bufferedAhead} />
        </div>
      </>
    );
  if (level === "keys")
    return (
      <>
        {back(t("shortcuts"))}
        <div className="px-3 pt-1 pb-2">
          <ShortcutRows subtitles={subtitles} next={hasNext} segments={hasSegments} />
        </div>
      </>
    );
  return (
    <div role="menu" aria-label={t("settings")} className="flex flex-col">
      <SettingRow label={t("quality")} value={quality ?? undefined} onOpen={renditions.length > 1 ? () => onLevel("quality") : undefined} />
      <SettingRow label={t("speed")} value={speedName(rate)} onOpen={() => onLevel("speed")} />
      {sources && <SettingRow label={t("source")} value={current ? info.version : undefined} onOpen={() => onLevel("source")} />}
      <SettingRow label={t("playbackInfo")} onOpen={() => onLevel("info")} />
      {!coarse && <SettingRow label={t("shortcuts")} onOpen={() => onLevel("keys")} />}
    </div>
  );
}
