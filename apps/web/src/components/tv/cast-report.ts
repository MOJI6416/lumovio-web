"use client";

import type { CastFailure, TvPlaybackReport, TvPlaybackState } from "@lumovio/contracts";
import { useEffect, useRef } from "react";
import { background } from "@/lib/optional";

/** A playing viewing says where it is this often, so a phone that opens its remote starts from the right time. */
const EVERY_MS = 30_000;

/**
 * Where a TV's viewing is, for the phones driving it: `preparing` — a copy is being started or
 * chosen; `video` — the player is there, its own element says playing, paused or ended; a failure — why it didn't start.
 */
export type CastStatus = "preparing" | "video" | { failure: CastFailure };

// A beat nobody waits on (lib/optional `background`): the next one says the state again.
const send = (body: TvPlaybackReport, keepalive = false) =>
  background(fetch("/api/devices/playback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", keepalive }));

/**
 * The TV's side of "Watch on TV": what it plays is said to the API (`POST /api/devices/playback`) when it changes — a
 * play, a pause, a seek, the end, a failure — and every 30 s while playing; leaving the player says it stopped. The
 * phone's remote shows it (./CastDialog). Only in the TV shell (`on`).
 */
export function useCastReport({
  on,
  castId,
  title,
  status,
  media,
}: {
  on: boolean;
  castId: string | null;
  title: { titleId: string; kind: "movie" | "tv"; tmdbId: number; title: string; season: number | null; episode: number | null };
  status: CastStatus;
  /** The stream playing (another source or track is another element). */
  media: string | null;
}) {
  const info = useRef(title);
  info.current = title;
  const cast = useRef(castId);
  cast.current = castId;
  const kind = typeof status === "string" ? status : "failed";
  const failure = typeof status === "string" ? null : status.failure;

  useEffect(() => {
    if (!on) return;
    const report = (state: TvPlaybackState, positionSec = 0, durationSec: number | null = null, failure: CastFailure | null = null) =>
      send({ ...info.current, state, positionSec: Math.max(0, positionSec), durationSec: durationSec && Number.isFinite(durationSec) ? durationSec : null, castId: cast.current, failure });
    if (kind === "preparing") {
      report("preparing");
      return;
    }
    if (kind === "failed") {
      report("failed", 0, null, failure);
      return;
    }
    // The player's own element (a new one for another stream): on the watch screen it is the only video.
    if (media === null) return;
    let video: HTMLVideoElement | null = null;
    let timer: number | undefined;
    const now = () => {
      if (!video) return;
      report(video.ended ? "ended" : video.paused ? "paused" : "playing", video.currentTime, video.duration);
    };
    // A burst of events (a seek is seeking, seeked, play) said once.
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(now, 250);
    };
    const events = ["play", "pause", "seeked", "ended", "durationchange"] as const;
    const attach = () => {
      video = document.querySelector("video");
      if (!video) return false;
      for (const e of events) video.addEventListener(e, soon);
      soon();
      return true;
    };
    // The element comes with the player's first render.
    let wait: number | undefined;
    if (!attach()) wait = window.setInterval(() => attach() && window.clearInterval(wait), 200);
    const every = window.setInterval(() => {
      if (video && !video.paused && !video.ended) now();
    }, EVERY_MS);
    return () => {
      window.clearInterval(wait);
      window.clearInterval(every);
      window.clearTimeout(timer);
      if (video) for (const e of events) video.removeEventListener(e, soon);
    };
  }, [on, kind, failure, media]);

  // Out of the player: nothing plays any more.
  useEffect(() => {
    if (!on) return;
    const gone = () => send({ state: "stopped" }, true);
    window.addEventListener("pagehide", gone);
    return () => {
      window.removeEventListener("pagehide", gone);
      gone();
    };
  }, [on]);
}
