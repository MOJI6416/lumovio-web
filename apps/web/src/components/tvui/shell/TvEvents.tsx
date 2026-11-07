"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect } from "react";
import { useTvNav } from "../nav/TvNav";

type RemoteKey = "up" | "down" | "left" | "right" | "ok" | "back" | "home" | "play";
type DeviceEvent =
  | { type: "changed"; kind: string }
  | { type: "revoked" }
  | { type: "remote"; key?: RemoteKey; text?: string }
  | { type: "cast"; castId: string; href: string; switched: boolean }
  | { type: "playback"; action: "toggle" | "stop" | "seek"; delta?: number };

/** Changes are applied once the remote has rested this long (TV document §12.4: not while an arrow is held). */
const IDLE_MS = 2500;
/** Progress of a viewing on another device arrives every 10 s: the TV takes it at most this often. */
const PROGRESS_MS = 60_000;
const KEYS: Record<string, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", back: "GoBack", play: " " };

/**
 * The TV's side of the event stream (TV document §7.2, §7.3, §12.4): what changed on a phone or a computer — lists,
 * progress, a profile's preferences, servers and the copies on them (`index`: a torrent added, linked or removed, a
 * scan) — is fetched again when the remote rests and no layer is open (the
 * current viewing isn't touched); after a gap (sleep, lost network) everything shown is; a session removed from
 * Devices goes back to the code screen at once; the phone remote's keys go the way the remote's keys go, its text
 * into the search. Reconnects with a growing pause up to a minute; no polling.
 */
export function TvEvents() {
  const nav = useTvNav();
  const qc = useQueryClient();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 1000;
    let reconnect: number | undefined;
    let flushTimer: number | undefined;
    let lastKey = 0;
    let lastProgress = 0;
    let stale = false;
    let stopped = false;
    const home = (path: string) => `${locale === "en" ? "" : `/${locale}`}${path}`;

    const onKey = () => {
      lastKey = performance.now();
    };
    window.addEventListener("keydown", onKey, true);

    const flush = () => {
      flushTimer = undefined;
      if (!stale) return;
      if (performance.now() - lastKey < IDLE_MS || document.querySelector("[data-tv-layer]") || document.querySelector("[data-player]")) {
        flushTimer = window.setTimeout(flush, 1500);
        return;
      }
      stale = false;
      void qc.invalidateQueries();
      router.refresh();
    };
    const markStale = () => {
      stale = true;
      flushTimer ??= window.setTimeout(flush, 800);
    };

    const press = (key: RemoteKey) => {
      if (key === "home") return nav.navigate("/");
      const active = document.activeElement as HTMLElement | null;
      if (key === "ok" && active && active !== document.body && !active.matches("[data-player], input, textarea") && active.matches("a, button, [role=button], [tabindex]")) {
        active.click();
        return;
      }
      const target = active && active !== document.body ? active : document.body;
      target.dispatchEvent(new KeyboardEvent("keydown", { key: key === "ok" ? "Enter" : KEYS[key], bubbles: true, cancelable: true }));
    };

    const onEvent = (e: DeviceEvent) => {
      if (e.type === "revoked") {
        window.location.assign(home("/tv"));
        return;
      }
      if (e.type === "remote") {
        if (e.key) press(e.key);
        else if (e.text) {
          // Into the text field on screen (the search's, the sources screen's query), else a search for it.
          if (document.querySelector("[data-tv-search-field]")) window.dispatchEvent(new CustomEvent("lumovio:tv-text", { detail: e.text }));
          else nav.navigate(`/search?q=${encodeURIComponent(e.text)}`);
        }
        return;
      }
      // "Watch on TV" (design-system 8.18): a phone's viewing opens here at once — in place of the one playing, so Back
      // from it doesn't start that one again; after its profile was switched to the phone's the TV loads anew in it.
      if (e.type === "cast") {
        if (e.switched) window.location.assign(home(e.href));
        else nav.navigate(e.href, { replace: /\/watch\//.test(window.location.pathname) });
        return;
      }
      // The phone's remote of that viewing: the player takes play/pause and seeks, the viewing its stop.
      if (e.type === "playback") {
        if (e.action === "stop") window.dispatchEvent(new CustomEvent("lumovio:cast-stop"));
        else window.dispatchEvent(new CustomEvent("lumovio:cast-control", { detail: { action: e.action, delta: e.delta } }));
        return;
      }
      // A kind of event this version doesn't know isn't a change to fetch again.
      if (e.type !== "changed") return;
      if (e.kind === "progress") {
        if (Date.now() - lastProgress < PROGRESS_MS) return;
        lastProgress = Date.now();
      }
      markStale();
    };

    const connect = () => {
      if (stopped) return;
      es = new EventSource("/api/events");
      es.onopen = () => {
        // Back after a gap: what is shown may be old.
        if (retry > 1000) markStale();
        retry = 1000;
      };
      es.onmessage = (m) => {
        try {
          onEvent(JSON.parse(m.data) as DeviceEvent);
        } catch {
          // A message this version doesn't know: nothing to do.
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        // Signed out elsewhere (or the session expired): the code screen, not an endless retry.
        void (async () => {
          try {
            const r = await fetch("/api/me", { credentials: "same-origin" });
            if (r.status === 401) window.location.assign(home("/tv"));
          } catch {
            // No network: the stream's own reconnect below tries again.
          }
        })();
        reconnect = window.setTimeout(connect, retry);
        retry = Math.min(60_000, retry * 2);
      };
    };
    connect();

    // A TV woken from sleep or brought back to the page: fetch what it shows again.
    const onVisible = () => {
      if (document.visibilityState === "visible") markStale();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      es?.close();
      window.clearTimeout(reconnect);
      window.clearTimeout(flushTimer);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [nav, qc, router, locale]);

  return null;
}
