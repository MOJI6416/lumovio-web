"use client";

import type { SubtitleStyle } from "@lumovio/contracts";
import { usePlayer } from "@videojs/react/video";
import { Info, Keyboard, Play, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react";
import { ServerMark } from "@/components/connections/ServerMark";
import { SourceRow } from "@/components/sources/SourceRow";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { OFFSET_STEP, stepOffset } from "@/lib/media/subs/view";
import type { PreparedPlayback } from "@/lib/media/types";
import type { SubtitleLook, SubtitleMeta } from "./LumovioPlayer";
import { type EpisodesInfo, EpisodesBody, FORMAT_NAME, InfoBody, type PlayerPanel, ShortcutRows, type SourcesInfo, Surface, useSignedSeconds, useTrackWords } from "./player-parts";

/** The TV bar's buttons the menus stand over (and give the focus back to). */
export interface TvAnchors {
  tracks: RefObject<HTMLButtonElement | null>;
  settings: RefObject<HTMLButtonElement | null>;
  episodes: RefObject<HTMLButtonElement | null>;
  source: RefObject<HTMLButtonElement | null>;
}

/**
 * The TV's menus (TV document §6; drawn by TvChrome — the site has PlayerMenus), each opened by its button in the bar:
 * a surface over the picture above that button, as on the site (player-parts' Surface, 11.1) — the picture neither
 * moves aside nor darkens. Back (a layer of the shell's history), Escape or a press outside closes it and the focus goes
 * back to the button (PLR-11): audio and subtitles side by side (tracks in words, PLR-07), quality and speed, playback
 * info (how the stream reaches the screen, PLR-06), the episodes of every season, the source (other copies; the
 * search). Keyboard shortcuts — only what this video has — in a dialog.
 */
export function PlayerPanels({
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
  anchors: TvAnchors;
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
  const close = () => onPanel("none");
  // A TV remote's OK (Enter) chooses in the lists: ui/RadioGroup does it (C19).
  return (
    <>
      {panel === "tracks" && (
        <Surface anchor={anchors.tracks} label={t("audioAndSubtitles")} onClose={close} over="bar" className="w-200 p-6">
          <TracksBody prepared={prepared} onAudioChange={onAudioChange} currentTime={currentTime} originalLanguage={originalLanguage} subtitleMeta={subtitleMeta} look={look} />
        </Surface>
      )}
      {panel === "settings" && (
        <Surface anchor={anchors.settings} label={t("qualityAndSpeed")} onClose={close} over="bar" className="w-100 p-6">
          <SettingsBody onInfo={() => onPanel("info")} onHelp={() => onPanel("help")} />
        </Surface>
      )}
      {panel === "info" && (
        <Surface anchor={anchors.settings} label={t("playbackInfo")} onClose={close} over="bar" className="w-120 p-6">
          <InfoBody prepared={prepared} info={info} bufferedAhead={bufferedAhead} />
        </Surface>
      )}
      {episodes && panel === "episodes" && (
        <Surface anchor={anchors.episodes} label={t("episodes")} onClose={close} over="bar" className="w-120 p-6">
          <EpisodesBody episodes={episodes} onPick={close} />
        </Surface>
      )}
      {sources && panel === "source" && (
        <Surface anchor={anchors.source} label={t("source")} onClose={close} over="bar" className="w-160 p-6">
          <p className="sr-only">{t("sourcePanelText")}</p>
          <SourceBody
            sources={sources}
            onPick={(key) => {
              close();
              sources.onPick(key, currentTime);
            }}
            onSearch={
              sources.onSearch &&
              (() => {
                close();
                sources.onSearch?.(currentTime);
              })
            }
          />
        </Surface>
      )}
      <Dialog open={panel === "help"} onOpenChange={(o) => !o && close()} title={t("shortcuts")} size="sm">
        <ShortcutRows subtitles={prepared.subtitles.length > 0 || Boolean(subtitleMeta?.size)} next={hasNext} segments={hasSegments} />
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
  // Side by side, as the site's menu (11.1): the audio, then the subtitles with their size and timing — short enough to
  // stand over the button.
  return (
    <div className="grid grid-cols-2 gap-10">
      <div className="flex min-w-0 flex-col gap-6">
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
            {audio.length > 1 && !canSwitch && <Note>{t("audioNoSwitch")}</Note>}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
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
    </div>
  );
}

/**
 * The subtitles' size (saved to the profile; the rest of their look is in Settings → Profile) and their timing for this
 * title: "Earlier" when they come after the speech, "Later" when before, half a second a press (G / H on a keyboard).
 */
function SubtitleLookBody({ look }: { look: SubtitleLook }) {
  const t = useTranslations("player");
  const ts = useTranslations("subtitles");
  const signed = useSignedSeconds();
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
        {look.sizeFailed && <Note>{ts("sizeFailed")}</Note>}
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
      </section>
    </>
  );
}

/** Quality and speed: the stream's real versions (one file is one quality, said so), the speed, playback info, the keys. */
function SettingsBody({ onInfo, onHelp }: { onInfo: () => void; onHelp: () => void }) {
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
