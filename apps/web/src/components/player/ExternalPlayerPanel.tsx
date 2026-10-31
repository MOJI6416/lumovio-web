"use client";

import { CircleCheck, Copy, Download, ExternalLink, MonitorPlay, ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { PreparedPlayback } from "@/lib/media/types";
import { useAction } from "@/lib/use-action";

/**
 * A file this browser can't play (design-system 11.1, PLR-08): why, in words; the main button opens it in an app on
 * this device (VLC or MX Player on Android, VLC, Infuse or nPlayer on an iPhone; on a computer a playlist VLC opens); a copy of the title that plays here is
 * offered when there is one. A web page can't read the other app's position, so progress is honest: once the app was
 * opened, "I've finished it" marks the title watched — a secondary button, never the first thing on the screen.
 */
export function ExternalPlayerPanel({
  prepared,
  title,
  reason,
  titleId,
  season,
  episode,
  onFinished,
  inBrowser,
}: {
  prepared: PreparedPlayback;
  title: string;
  /** Why it can't play here, already in words. */
  reason: string | null;
  titleId: string;
  season: number | null;
  episode: number | null;
  onFinished: () => void;
  /** Another copy of this title that plays in the browser: its version and how to start it. */
  inBrowser: { version: string; play: () => void } | null;
}) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [launched, setLaunched] = useState(false);
  const [marked, setMarked] = useState(false);
  const url = prepared.externalUrl;
  // A failure says so and leaves the button pressable again (audit X-15: it used to count as watched anyway).
  const finish = useAction({
    run: () => api("/api/history/mark", { method: "POST", json: { titleId, season, episode, watched: true } }),
    optimistic: () => {
      setMarked(true);
      return () => setMarked(false);
    },
  });
  const copy = useAction({
    run: async () => {
      await navigator.clipboard.writeText(url ?? "");
      setLaunched(true);
    },
    success: tc("copied"),
  });
  if (!url) return null;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const android = /Android/.test(ua);
  const ios = /iPhone|iPad|iPod/.test(ua);
  const hasCreds = (() => {
    try {
      const u = new URL(url);
      return Boolean(u.username || u.password || /api_key|X-Plex-Token/i.test(u.search));
    } catch {
      return false;
    }
  })();

  const m3u = () => {
    const blob = new Blob([`#EXTM3U\n#EXTINF:-1,${title}\n${url}\n`], { type: "audio/x-mpegurl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 60) || "lumovio"}.m3u`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setLaunched(true);
  };

  // The app on this device: the first is the main button (one per area, 7.1), the rest secondary.
  const apps: { href: string; label: string }[] = android
    ? [
        { href: `intent:${url}#Intent;package=org.videolan.vlc;type=video/*;S.title=${encodeURIComponent(title)};end`, label: t("openVlc") },
        { href: `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;S.title=${encodeURIComponent(title)};end`, label: t("openMx") },
      ]
    : ios
      ? [
          { href: `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`, label: t("openVlc") },
          { href: `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`, label: t("openInfuse") },
          // nPlayer opens any address prefixed with its scheme.
          { href: `nplayer-${url}`, label: t("openNplayer") },
        ]
      : [];
  return (
    <section aria-labelledby="external-h" className="flex flex-col gap-4 rounded-md border border-line bg-surface-1 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <h2 id="external-h" className="text-h3 text-text-1">
          {t("externalTitle")}
        </h2>
        {reason && (
          <p className="flex items-start gap-2 text-body text-text-1">
            <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
            {reason}
          </p>
        )}
        {/* The apps of this device's platform (PLR-16: no MX Player on an iPhone). */}
        <p className="text-body-s text-text-2">
          {t("externalText", { apps: new Intl.ListFormat(locale, { type: "disjunction" }).format(ios ? ["VLC", "Infuse", "nPlayer"] : android ? ["VLC", "MX Player"] : ["VLC", "mpv"]) })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 max-sm:flex-col">
        {apps.map((a, i) => (
          <a key={a.href} className={buttonClass(i === 0 ? "primary" : "secondary", "md")} href={a.href} onClick={() => setLaunched(true)}>
            <ExternalLink aria-hidden />
            {a.label}
          </a>
        ))}
        {/* A downloaded playlist goes nowhere on an iPhone: the apps above open the stream instead. */}
        {!ios && (
          <Button variant={apps.length === 0 ? "primary" : "secondary"} icon={Download} onClick={m3u}>
            {t("downloadPlaylist")}
          </Button>
        )}
        <Button variant="secondary" icon={Copy} loading={copy.pending} onClick={() => void copy.run()}>
          {t("copyLink")}
        </Button>
      </div>
      {hasCreds && (
        <p className="flex items-start gap-2 text-body-s text-text-2">
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          {t("linkWarning")}
        </p>
      )}
      {inBrowser && (
        <div className="flex flex-col items-start gap-2 border-t border-line pt-4">
          <p className="text-body-s text-text-2">{t("inBrowserText", { version: inBrowser.version })}</p>
          <Button variant="secondary" icon={MonitorPlay} onClick={inBrowser.play}>
            {t("inBrowser")}
          </Button>
        </div>
      )}
      {launched && (
        <div className="flex flex-col items-start gap-2 border-t border-line pt-4" aria-live="polite">
          {marked ? (
            <p className="flex items-center gap-2 text-body text-text-1">
              <CircleCheck aria-hidden className="size-5 text-success" />
              {t("markedFinished")}
            </p>
          ) : (
            <>
              <p className="text-body-s text-text-2">{t("finishedText")}</p>
              <Button
                variant="secondary"
                icon={CircleCheck}
                loading={finish.pending}
                onClick={async () => {
                  if ((await finish.run()).ok) onFinished();
                }}
              >
                {t("markFinished")}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
