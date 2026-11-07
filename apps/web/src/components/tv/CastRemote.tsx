"use client";

import type { TvDevice, TvPlayback } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, RotateCcw, RotateCw, Square, Tv } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { DialogActions } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Progress } from "@/components/ui/Progress";
import { Link } from "@/i18n/navigation";
import { formatClock } from "@/lib/format";
import { controlTv, TVS_KEY, useTvs } from "./cast";

/** A TV that hasn't said it got the viewing in this long didn't answer (a weak TV loads its player anew after a switch). */
const ANSWER_MS = 20_000;

/**
 * What a TV plays, live: the TV says it over the event stream (`/api/events?tv=`), the list of TVs gives the first word
 * and the one after a gap. Between its words a playing viewing's time runs on here.
 */
export function useTvPlayback(tv: TvDevice): TvPlayback | null {
  const tvs = useTvs();
  const listed = tvs.data?.devices.find((d) => d.id === tv.id)?.playback ?? tv.playback;
  const [live, setLive] = useState<{ playback: TvPlayback | null; at: number } | null>(null);
  const qc = useQueryClient();
  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 1000;
    let timer: number | undefined;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      es = new EventSource(`/api/events?tv=${encodeURIComponent(tv.id)}`);
      es.onopen = () => {
        // Back after a gap: the list says how it is now.
        if (retry > 1000) void qc.invalidateQueries({ queryKey: TVS_KEY });
        retry = 1000;
      };
      es.onmessage = (m) => {
        try {
          const e = JSON.parse(m.data) as { type: string; tv?: string; playback?: TvPlayback | null };
          if (e.type === "tv-state" && e.tv === tv.id) setLive({ playback: e.playback ?? null, at: Date.now() });
        } catch {
          // Not this stream's news.
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        timer = window.setTimeout(connect, retry);
        retry = Math.min(30_000, retry * 2);
      };
    };
    connect();
    return () => {
      stopped = true;
      es?.close();
      window.clearTimeout(timer);
    };
  }, [tv.id, qc]);
  // The newer of the two: the stream's word, or the list fetched after it (after a gap).
  return live && live.at > tvs.dataUpdatedAt ? live.playback : listed;
}

/**
 * The remote of the viewing on the TV (design-system 8.18): what plays and where — "Playing on TV · Android" —, the
 * time gone and left, −10 · Play/Pause · +10, and "Stop on TV". Until the TV says it got the viewing: "Starting on …";
 * no word in 20 s — it didn't answer; the TV's failure in words, with "Send again". The same block in the dialog after
 * "Watch on TV" and at the top of the remote (/remote): `full` — the dialog's way to the whole remote (arrows, OK…);
 * `framed` — the remote's card with the title and episode as its heading, nothing while the TV plays nothing.
 */
export function CastRemote({
  tv,
  castId,
  name,
  sending = false,
  onResend,
  full = false,
  framed = false,
}: {
  tv: TvDevice;
  castId: string | null;
  name: string;
  sending?: boolean;
  onResend?: () => void;
  full?: boolean;
  framed?: boolean;
}) {
  const t = useTranslations("cast");
  const tr = useTranslations("remote");
  const tp = useTranslations("player");
  const p = useTvPlayback(tv);
  const mine = castId === null || p?.castId === castId;
  const [late, setLate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Waiting for the TV's first word about this sending (once heard, what the TV plays is what is shown).
  const [heard, setHeard] = useState(castId === null);
  useEffect(() => {
    if (castId !== null && p?.castId === castId) setHeard(true);
  }, [castId, p?.castId]);
  const waiting = sending || !heard;
  useEffect(() => {
    if (!waiting || sending) return;
    setLate(false);
    const id = window.setTimeout(() => setLate(true), ANSWER_MS);
    return () => window.clearTimeout(id);
  }, [waiting, sending]);
  const playing = p?.state === "playing";
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  const control = async (c: Parameters<typeof controlTv>[1]) => {
    setError(null);
    try {
      const r = await controlTv(tv.id, c);
      if (!r.online) setError(t("offline"));
    } catch {
      setError(t("notSent"));
    }
  };

  // The remote shows what plays; a sending's failure is the dialog's to say.
  if (framed && p?.state === "failed") return null;
  if (!waiting && mine && p?.state === "failed")
    return (
      <>
        <InlineAlert tone="danger" title={t("failedTitle")}>
          {t(`fail_${p.failure ?? "other"}`)}
        </InlineAlert>
        {onResend && (
          <DialogActions>
            <Button onClick={onResend}>{t("sendAgain")}</Button>
          </DialogActions>
        )}
      </>
    );
  if (waiting && late)
    return (
      <>
        <InlineAlert tone="warning">{t("noAnswer")}</InlineAlert>
        {onResend && (
          <DialogActions>
            <Button onClick={onResend}>{t("sendAgain")}</Button>
          </DialogActions>
        )}
      </>
    );

  const shown = waiting ? null : p;
  if (framed && !shown) return null;
  const status = sending ? t("sending") : !shown ? (waiting ? t("starting") : t("stopped")) : shown.state === "preparing" ? t("starting") : shown.state === "ended" ? t("ended") : shown.state === "paused" ? t("paused") : t("playing");
  const live = shown && (shown.state === "playing" || shown.state === "paused");
  // A playing viewing's time runs on between the TV's words (a minute at most: the TV says it every 30 s).
  const run = shown?.state === "playing" ? Math.min(60, Math.max(0, (now - shown.at) / 1000)) : 0;
  const pos = shown ? Math.min(shown.durationSec ?? Number.POSITIVE_INFINITY, shown.positionSec + run) : 0;
  const dur = shown?.durationSec ?? null;

  const body = (
    <div className="flex flex-col gap-5">
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-body-s text-text-2">
        <Tv aria-hidden className={cn("size-4 shrink-0", live && "text-accent")} />
        <span className="min-w-0 truncate font-semibold text-text-1">{name}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0">{status}</span>
      </p>
      {live && (
        <div className="flex flex-col gap-1.5">
          <Progress value={dur ? (pos / dur) * 100 : null} label={tp("timeline")} />
          <div className="flex justify-between text-body-s font-semibold text-text-2 tabular-nums">
            <span>{formatClock(pos)}</span>
            <span>{dur ? `−${formatClock(Math.max(0, dur - pos))}` : ""}</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-center gap-4">
        <IconButton icon={RotateCcw} label={tp("back10")} variant="secondary" size="lg" disabled={!live} onClick={() => void control({ action: "seek", delta: -10 })} />
        {/* The one that matters most, the largest (as the player's touch controls, 11.1). */}
        <IconButton
          icon={shown?.state === "playing" ? Pause : Play}
          label={shown?.state === "playing" ? tp("pause") : tp("play")}
          variant="primary"
          size="xl"
          disabled={!live}
          className="[&_svg]:fill-current"
          onClick={() => void control({ action: "toggle" })}
        />
        <IconButton icon={RotateCw} label={tp("forward10")} variant="secondary" size="lg" disabled={!live} onClick={() => void control({ action: "seek", delta: 10 })} />
      </div>
      <Button variant="secondary" icon={Square} disabled={!shown && !waiting} onClick={() => void control({ action: "stop" })} className="w-full">
        {t("stop")}
      </Button>
      {error && <p className="text-body-s text-danger">{error}</p>}
      {full && (
        <Link href="/remote" className={buttonClass("tertiary", "sm", "self-center")}>
          <Tv aria-hidden />
          {tr("title")}
        </Link>
      )}
    </div>
  );
  if (!framed || !shown) return body;
  // On the remote: what plays, as the dialog's title and line say it.
  return (
    <section aria-labelledby="now-on-tv" className="flex flex-col gap-4 rounded-lg bg-surface-1 p-4">
      <div className="min-w-0">
        <h2 id="now-on-tv" className="truncate text-h3 text-text-1">
          {shown.title}
        </h2>
        {shown.season !== null && shown.episode !== null && <p className="truncate text-body-s text-text-2">{tp("episodeLabel", { season: shown.season, episode: shown.episode })}</p>}
      </div>
      {body}
    </section>
  );
}
