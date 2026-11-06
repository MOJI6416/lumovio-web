import { withoutLocale } from "./locale-path";
import { background } from "./optional";

/**
 * Field speed of the site (docs/performance-handoff-2026-10-24.md §5.3): this page load's LCP, INP and CLS, sent once
 * as the page is left or hidden, with the kind of page and of device only — no title, account or cookie (the API counts
 * them into day histograms, its perf module). Nothing is measured or sent with Do Not Track or Global Privacy
 * Control. Loaded when the page is idle (components/providers/Providers), not with the first JS.
 */
type Group = "home" | "section" | "catalog" | "title" | "person" | "watch" | "search" | "library" | "list" | "settings" | "auth" | "tv" | "other";
type Device = "desktop" | "phone" | "tv";

/** The kind of page a path is, as the API's histograms group them (perf/vitals.ts GROUPS). */
export function pageGroup(pathname: string, tv: boolean): Group {
  if (tv) return "tv";
  const p = withoutLocale(pathname);
  if (p === "/") return "home";
  if (/^\/(browse\/(movie|tv)|anime)$/.test(p)) return "section";
  if (p.startsWith("/browse") || p.startsWith("/catalog") || p.startsWith("/discover")) return "catalog";
  if (p.startsWith("/title/")) return "title";
  if (p.startsWith("/person/")) return "person";
  if (p.startsWith("/watch/")) return "watch";
  if (p.startsWith("/search")) return "search";
  if (p.startsWith("/lists/") || p.startsWith("/u/")) return "list";
  if (p.startsWith("/library") || p.startsWith("/history") || p.startsWith("/calendar") || p.startsWith("/stats")) return "library";
  if (p.startsWith("/settings") || p.startsWith("/profiles")) return "settings";
  if (p.startsWith("/auth")) return "auth";
  return "other";
}

export const optedOut = () =>
  typeof navigator === "undefined" || navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

const deviceOf = (tv: boolean): Device => (tv ? "tv" : window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 1024 ? "phone" : "desktop");

let started = false;

/** Starts measuring this page load (once). */
export function startVitals(tv: boolean) {
  // Automation (headless checks, crawlers driving a browser) isn't a person's visit: it would skew the field numbers.
  if (started || optedOut() || navigator.webdriver || typeof PerformanceObserver === "undefined") return;
  started = true;
  const group = pageGroup(location.pathname, tv);
  const device = deviceOf(tv);
  let lcp: number | null = null;
  let inp = 0;
  let interactions = 0;
  // CLS as the web defines it: the largest session window (shifts < 1 s apart, ≤ 5 s long), without shifts after input.
  let cls = 0;
  let windowValue = 0;
  let windowStart = 0;
  let windowLast = 0;
  const observe = (type: string, onEntries: (list: PerformanceEntryList) => void, opts: Record<string, unknown> = {}) => {
    try {
      new PerformanceObserver((l) => onEntries(l.getEntries())).observe({ type, buffered: true, ...opts } as PerformanceObserverInit);
    } catch {
      // Not in this browser (Safari has no LCP or Event Timing): that value isn't sent.
    }
  };
  observe("largest-contentful-paint", (entries) => {
    const last = entries.at(-1);
    if (last) lcp = last.startTime;
  });
  observe("layout-shift", (entries) => {
    for (const e of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (e.hadRecentInput) continue;
      if (windowValue && e.startTime - windowLast < 1000 && e.startTime - windowStart < 5000) windowValue += e.value;
      else {
        windowValue = e.value;
        windowStart = e.startTime;
      }
      windowLast = e.startTime;
      cls = Math.max(cls, windowValue);
    }
  });
  // INP, close enough for a page's few dozen interactions: the slowest one.
  observe(
    "event",
    (entries) => {
      for (const e of entries as (PerformanceEntry & { interactionId?: number })[]) {
        if (!e.interactionId) continue;
        interactions++;
        inp = Math.max(inp, e.duration);
      }
    },
    { durationThreshold: 16 },
  );
  let sent = false;
  const send = () => {
    if (sent) return;
    sent = true;
    const v = [
      ...(lcp !== null ? [{ m: "lcp", x: Math.round(lcp), g: group, d: device }] : []),
      ...(interactions ? [{ m: "inp", x: Math.round(inp), g: group, d: device }] : []),
      { m: "cls", x: Math.round(cls * 1000) / 1000, g: group, d: device },
    ];
    // No cookie goes with it (a beacon would carry the session's): the counts are anonymous.
    background(fetch("/api/vitals", { method: "POST", body: JSON.stringify({ v }), headers: { "content-type": "application/json" }, credentials: "omit", keepalive: true }));
  };
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && send());
  window.addEventListener("pagehide", send);
}
