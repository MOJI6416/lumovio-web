"use client";

import { Check, Copy, Minus, Play, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useWhy } from "@/components/player/use-why";
import { type Status, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { detectCapabilities, type PlaybackCapabilities } from "@/lib/media/capabilities";
import { type BrowserFacts, browserFacts, type ClipResult, REFERENCE_CLIPS, reportText, runClip } from "@/lib/media/player-check";
import { useAction } from "@/lib/use-action";

/**
 * "Device check" (/dev/player-check): what this browser can
 * play and which formats of real releases open in Lumovio's player here — each reference clip started the way the
 * player would, muted — with a report to copy and send. A Tool page: the header, then two panels.
 */
export function PlayerCheck() {
  const t = useTranslations("playerCheck");
  const tc = useTranslations("common");
  const tp = useTranslations("player");
  const why = useWhy();
  const [caps, setCaps] = useState<PlaybackCapabilities | null>(null);
  const [facts, setFacts] = useState<BrowserFacts | null>(null);
  const [results, setResults] = useState<Record<string, ClipResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setCaps(detectCapabilities());
    let live = true;
    void browserFacts().then((f) => live && setFacts(f));
    return () => {
      live = false;
    };
  }, []);

  const run = async () => {
    const video = videoRef.current;
    if (!caps || !video || running) return;
    setResults({});
    for (const clip of REFERENCE_CLIPS) {
      setRunning(clip.id);
      const r = await runClip(clip, caps, video);
      setResults((prev) => ({ ...prev, [clip.id]: r }));
    }
    setRunning(null);
  };

  const done = Object.keys(results).length;
  const copy = useAction({
    run: () => navigator.clipboard.writeText(reportText(caps!, facts!, REFERENCE_CLIPS.flatMap((c) => results[c.id] ?? []))),
    success: tc("copied"),
  });

  const status = (r: ClipResult | undefined, id: string): { status: Status; word: string } =>
    running === id
      ? { status: "neutral", word: t("statusRunning") }
      : !r
        ? { status: "neutral", word: t("statusUntested") }
        : r.outcome === "works"
          ? { status: "success", word: t("statusWorks") }
          : r.outcome === "external"
            ? { status: "warning", word: t("statusExternal") }
            : { status: "danger", word: t("statusFails") };

  const seconds = (ms: number) => (ms / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const detail = (r: ClipResult | undefined) => {
    if (!r) return null;
    if (r.outcome === "external") return why(r.reason).join(". ");
    if (r.outcome === "fails") return t(`error_${r.error ?? "engine"}`);
    return [
      r.path === "direct" ? tp("probeDirect") : tp("probeRebuilt"),
      r.path === "legacy" ? t("videoToH264") : null,
      r.route ? t(`route_${r.route}`) : null,
      r.speed !== undefined ? t("decodeSpeed", { speed: r.speed.toLocaleString(undefined, { maximumFractionDigits: 1 }) }) : null,
      r.startMs !== undefined ? t("startTime", { seconds: seconds(r.startMs) }) : null,
      r.seekMs === null ? t("seekFailed") : r.seekMs !== undefined ? t("seekTime", { seconds: seconds(r.seekMs) }) : null,
      r.audio === false ? t("noAudio") : null,
      r.switched === true ? t("switchWorks") : r.switched === false ? t("switchFails") : null,
      r.subtitles
        ? t("subtitlesLine", {
            list: Object.entries(r.subtitles)
              .map(([k, v]) => {
                const [kind, lang] = k.split(":");
                const [format, ...extra] = (kind ?? "").split("-");
                const what = [format?.toUpperCase(), extra.includes("forced") ? t("subtitleForced") : null, extra.includes("file") ? t("subtitleFile") : null, lang].filter(Boolean).join(" ");
                return `${what} — ${t(`subtitle_${v || "fail"}`)}`;
              })
              .join(", "),
          })
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const yesNo = (b: boolean) => (
    <span className="inline-flex items-center gap-1">
      {b ? <Check aria-hidden className="size-4 text-success" /> : <Minus aria-hidden className="size-4 text-text-3" />}
      {b ? t("yes") : t("no")}
    </span>
  );
  const names = (o: Record<string, boolean>, labels: Record<string, string>) => {
    const have = Object.entries(labels).filter(([k]) => o[k]);
    return have.length ? have.map(([, l]) => l).join(" · ") : t("none");
  };

  const factRows: [string, ReactNode][] =
    caps && facts
      ? [
          [t("factBrowser"), caps.platform],
          [t("factMediaSource"), t(`mediaSource_${caps.mediaSource}`)],
          [t("factEncoders"), names(facts.encoders, { aac: "AAC", opus: "Opus" })],
          [t("factWorker"), t(`worker_${facts.worker}`)],
          [t("factHls"), yesNo(caps.hls === "native")],
          [t("factVideo"), names({ ...caps.video, dv: caps.dolbyVision }, { h264: "H.264", h264High10: "H.264 10-bit", hevc: "HEVC", hevc10: "HEVC 10-bit", av1: "AV1", vp9: "VP9", dv: "Dolby Vision 5" })],
          [t("factAudio"), names(caps.audio, { aac: "AAC", mp3: "MP3", opus: "Opus", flac: "FLAC", ac3: "AC-3", eac3: "E-AC-3", dts: "DTS" })],
          [t("factMseAudio"), caps.mediaSource === "none" ? t("none") : names(caps.mseAudio, { aac: "AAC", mp3: "MP3", opus: "Opus", flac: "FLAC", ac3: "AC-3", eac3: "E-AC-3", dts: "DTS" })],
          [t("factContainers"), names({ mp4: caps.containers.mp4, mkv: caps.containers.mkv === "likely", webm: caps.containers.webm }, { mp4: "MP4", mkv: "MKV", webm: "WebM" })],
          [t("factFullscreen"), t(`fullscreen_${facts.fullscreen}`)],
          [t("factPip"), yesNo(facts.pip)],
          [t("factHdr"), yesNo(caps.hdr)],
        ]
      : [];

  return (
    <div className="page-x">
      <div className="mx-auto max-w-tool pb-16">
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <>
              <Button icon={done ? RotateCcw : Play} loading={running !== null} disabled={!caps} onClick={() => void run()}>
                {running !== null ? t("running", { done: Math.min(done + 1, REFERENCE_CLIPS.length), total: REFERENCE_CLIPS.length }) : done ? t("runAgain") : t("run")}
              </Button>
              <Button variant="secondary" icon={Copy} disabled={!caps || !facts || running !== null} loading={copy.pending} onClick={() => void copy.run()}>
                {t("copyReport")}
              </Button>
            </>
          }
        />
        <div className="flex flex-col gap-6">
          <section aria-labelledby="pc-clips" className="rounded-md border border-line bg-surface-1 p-4 md:p-6">
            <h2 id="pc-clips" className="text-h3 text-text-1">
              {t("clipsTitle")}
            </h2>
            <p className="mt-1 max-w-measure text-body-s text-text-2">{t("clipsText")}</p>
            <div className="mt-4 flex flex-col gap-6 md:flex-row-reverse md:items-start">
              {/* The clip being tried, muted: its picture shows the check is real. */}
              <video ref={videoRef} muted playsInline aria-label={t("preview")} className="aspect-video w-full shrink-0 rounded-sm bg-black md:w-72" />
              <ul className="flex min-w-0 flex-1 flex-col divide-y divide-line">
                {REFERENCE_CLIPS.map((clip) => {
                  const r = results[clip.id];
                  const s = status(r, clip.id);
                  const d = detail(r);
                  return (
                    <li key={clip.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <p className="text-body font-semibold text-text-1">{clip.label}</p>
                        <p className="text-body-s text-text-2">{t(`hint_${clip.id}`)}</p>
                        {d && <p className="mt-1 text-body-s text-text-2">{d}</p>}
                      </div>
                      <StatusBadge status={s.status} className="self-start">
                        {s.word}
                      </StatusBadge>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section aria-labelledby="pc-caps" className="rounded-md border border-line bg-surface-1 p-4 md:p-6">
            <h2 id="pc-caps" className="text-h3 text-text-1">
              {t("capsTitle")}
            </h2>
            <p className="mt-1 max-w-measure text-body-s text-text-2">{t("capsText")}</p>
            {factRows.length === 0 ? (
              <div className="mt-4 flex flex-col gap-2" role="status" aria-label={t("capsTitle")}>
                <Skeleton shape="md" className="h-6 w-full" />
                <Skeleton shape="md" className="h-6 w-full" />
                <Skeleton shape="md" className="h-6 w-2/3" />
              </div>
            ) : (
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[minmax(0,16rem)_1fr]">
                {factRows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-body-s text-text-2">{label}</dt>
                    <dd className="text-body text-text-1 max-sm:-mt-2 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
