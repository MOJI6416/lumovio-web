"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";

/**
 * The speed meter (docs/performance-handoff-2026-10-24.md §5.2, design-system 10.3 "Замер"): `?perf=1` turns it on for
 * the tab (`?perf=0` or "Turn off" — off), and only then is this code loaded. It measures, from the page itself (a TV's
 * browser has no developer tools): input → the frame after it (the event's own time to a double requestAnimationFrame,
 * every key and tap), Event Timing's interaction durations, long tasks and long animation frames where the browser has
 * them, the page's elements and Chromium's JS heap. p50 / p95 / p99 / max over the screen; "Send" posts the summary to the
 * API for the owner's admin (only the owner's session may); on a TV — where the panel can't be reached by the remote —
 * the summary goes by itself every minute while there is something new.
 */
interface Stat {
  n: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export function statOf(values: number[]): Stat | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
  const r = (v: number) => Math.round(v);
  return { n: s.length, p50: r(at(50)), p95: r(at(95)), p99: r(at(99)), max: r(s.at(-1)!) };
}

const KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape", "Backspace", " "]);

export function PerfMeter({ tv, onOff }: { tv: boolean; onOff: () => void }) {
  const t = useTranslations("perf");
  const tr = useTranslations();
  const input = useRef<number[]>([]);
  const events = useRef<number[]>([]);
  const longTasks = useRef({ n: 0, totalMs: 0, maxMs: 0 });
  const frames = useRef<{ n: number; totalMs: number } | null>(null);
  const since = useRef(performance.now());
  const sentAt = useRef(0);
  const [, setTick] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onInput = (e: Event) => {
      if (e instanceof KeyboardEvent && !KEYS.has(e.key)) return;
      const t0 = e.timeStamp;
      requestAnimationFrame(() => requestAnimationFrame(() => input.current.push(performance.now() - t0)));
    };
    window.addEventListener("keydown", onInput, true);
    window.addEventListener("pointerdown", onInput, true);
    const observers: PerformanceObserver[] = [];
    const observe = (type: string, onEntries: (list: PerformanceEntryList) => void, opts: Record<string, unknown> = {}) => {
      try {
        const o = new PerformanceObserver((l) => onEntries(l.getEntries()));
        o.observe({ type, ...opts } as PerformanceObserverInit);
        observers.push(o);
        return true;
      } catch {
        return false;
      }
    };
    observe("longtask", (entries) => {
      for (const e of entries) {
        longTasks.current.n++;
        longTasks.current.totalMs += e.duration;
        longTasks.current.maxMs = Math.max(longTasks.current.maxMs, e.duration);
      }
    });
    observe(
      "event",
      (entries) => {
        for (const e of entries as (PerformanceEntry & { interactionId?: number })[]) if (e.interactionId) events.current.push(e.duration);
      },
      { durationThreshold: 16 },
    );
    // Long Animation Frames exist from Chromium 123: older TVs simply don't count them.
    if (
      observe("long-animation-frame", (entries) => {
        frames.current ??= { n: 0, totalMs: 0 };
        for (const e of entries) {
          frames.current.n++;
          frames.current.totalMs += e.duration;
        }
      })
    )
      frames.current = { n: 0, totalMs: 0 };
    const tick = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      window.removeEventListener("keydown", onInput, true);
      window.removeEventListener("pointerdown", onInput, true);
      for (const o of observers) o.disconnect();
      clearInterval(tick);
    };
  }, []);

  const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  const summary = () => ({
    path: location.pathname,
    device: tv ? ("tv" as const) : window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 1024 ? ("phone" as const) : ("desktop" as const),
    seconds: Math.round((performance.now() - since.current) / 1000),
    input: statOf(input.current),
    events: statOf(events.current),
    longTasks: { ...longTasks.current, totalMs: Math.round(longTasks.current.totalMs), maxMs: Math.round(longTasks.current.maxMs) },
    frames: frames.current && { n: frames.current.n, totalMs: Math.round(frames.current.totalMs) },
    dom: document.getElementsByTagName("*").length,
    heapMb: heap ? Math.round(heap / 1048576) : null,
  });
  const send = async (quiet = false) => {
    setSending(true);
    try {
      await api("/api/perf", { method: "POST", json: summary() });
      sentAt.current = input.current.length + events.current.length;
      if (!quiet) toast.success(t("sent"));
    } catch (e) {
      if (!quiet) toast.error(tr(apiErrorKey(e)));
    } finally {
      setSending(false);
    }
  };
  const reset = () => {
    input.current = [];
    events.current = [];
    longTasks.current = { n: 0, totalMs: 0, maxMs: 0 };
    if (frames.current) frames.current = { n: 0, totalMs: 0 };
    since.current = performance.now();
    sentAt.current = 0;
    setTick((n) => n + 1);
  };
  // On a TV the panel can't be reached: the summary goes by itself each minute something new was measured.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one timer for the meter's life
  useEffect(() => {
    if (!tv) return;
    const id = setInterval(() => {
      if (input.current.length + events.current.length > sentAt.current) void send(true);
    }, 60_000);
    return () => clearInterval(id);
  }, [tv]);

  const s = summary();
  const line = (label: string, x: Stat | null) => (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="tabular-nums">{x ? `${x.p50} · ${x.p95} · ${x.p99} · ${x.max} (${x.n})` : "—"}</dd>
    </div>
  );
  return (
    <section
      aria-label={t("meter")}
      className="fixed top-2 end-2 z-toast w-72 rounded-md border border-line bg-surface-2 p-3 text-caption text-text-1 shadow-float"
    >
      <h2 className="mb-1 font-semibold">{t("meter")}</h2>
      <p className="mb-2 text-text-3">p50 · p95 · p99 · max, ms</p>
      <dl className="flex flex-col gap-1">
        {line(t("input"), s.input)}
        {line(t("events"), s.events)}
        <div className="flex justify-between gap-3">
          <dt>{t("longTasks")}</dt>
          <dd className="tabular-nums">
            {s.longTasks.n} · {s.longTasks.totalMs} · max {s.longTasks.maxMs}
          </dd>
        </div>
        {s.frames && (
          <div className="flex justify-between gap-3">
            <dt>{t("frames")}</dt>
            <dd className="tabular-nums">
              {s.frames.n} · {s.frames.totalMs}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt>{t("dom")}</dt>
          <dd className="tabular-nums">{s.dom}</dd>
        </div>
        {s.heapMb !== null && (
          <div className="flex justify-between gap-3">
            <dt>{t("heap")}</dt>
            <dd className="tabular-nums">{s.heapMb}</dd>
          </div>
        )}
      </dl>
      {!tv && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={sending} onClick={() => void send()}>
            {t("send")}
          </Button>
          <Button size="sm" variant="tertiary" onClick={reset}>
            {t("reset")}
          </Button>
          <Button size="sm" variant="tertiary" onClick={onOff}>
            {t("off")}
          </Button>
        </div>
      )}
    </section>
  );
}
