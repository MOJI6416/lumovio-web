import type { DiscoveryEvent } from "@lumovio/contracts";
import { background } from "./optional";
import { withoutLocale } from "./locale-path";

/**
 * Discovery counters (C5): a card seen on a shelf (60% of it in view for a second), opened, and then
 * added to the watchlist or played. Sent in batches as anonymous counts — page, shelf, position,
 * whether the card had a copy on the profile's servers — never the title or the profile. Nothing is
 * sent when the browser asks not to be tracked (Do Not Track, Global Privacy Control).
 */
const ENDPOINT = "/api/catalog/metrics";
const queue: DiscoveryEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const optedOut = () =>
  typeof navigator === "undefined" || navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

function flush(leaving = false) {
  if (timer) clearTimeout(timer);
  timer = null;
  while (queue.length) {
    const body = JSON.stringify({ events: queue.splice(0, 200) });
    if (leaving && navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    else background(fetch(ENDPOINT, { method: "POST", body, headers: { "content-type": "application/json" }, credentials: "include", keepalive: true }));
  }
}

let listening = false;
function track(e: DiscoveryEvent) {
  if (optedOut()) return;
  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush(true));
    window.addEventListener("pagehide", () => flush(true));
  }
  queue.push(e);
  if (queue.length >= 200) flush();
  else timer ??= setTimeout(flush, 5000);
}

/**
 * The page a shelf is on: home, the section landings, a title page, or other. A page the API built in a C5 comparison
 * arm (`variant`, "lift_a" / "lift_b": API catalog/variants.ts) carries it at the end, so the same anonymous sums can be
 * compared by arm ("home_lift_b").
 */
export function discoveryPage(pathname: string, variant?: string): string {
  // Every interface language's prefix ("/de/browse/movie" counted as "other" before, 2026-11-01).
  const path = withoutLocale(pathname);
  const arm = variant && /^lift_[ab]$/.test(variant) ? `_${variant}` : "";
  if (path === "/") return `home${arm}`;
  if (path === "/browse/movie") return `movie${arm}`;
  if (path === "/browse/tv") return `tv${arm}`;
  if (path === "/anime") return `anime${arm}`;
  if (path.startsWith("/title/")) return "title";
  return "other";
}

/**
 * The shelf each title was last opened from, in this page's memory only (nothing is written to the
 * device), so it survives in-app navigation but not a reload.
 */
const opens = new Map<string, { page: string; shelf: string; slot: number; onServer: boolean; at: number; done: string[] }>();
/** An open counts towards a later watchlist add or play for this long. */
const ATTRIBUTION_MS = 30 * 60_000;

/**
 * Watches one shelf's cards (`a[data-title-id]`, the scroller's children): an impression once per
 * card and page view, an open on click, remembered in memory for a later watchlist add or play. Returns a cleanup.
 */
export function observeShelf(scroller: HTMLElement, page: string, shelf: string): () => void {
  if (optedOut() || !/^[a-z0-9_]{1,40}$/.test(shelf)) return () => {};
  const card = (el: Element) => (el.matches("a[data-title-id]") ? el : el.querySelector("a[data-title-id]")) as HTMLAnchorElement | null;
  const facts = (el: Element) => {
    const a = card(el);
    const slot = [...scroller.children].indexOf(el);
    return a && slot >= 0 && slot < 60 ? { titleId: a.dataset.titleId!, slot, onServer: a.dataset.onServer !== undefined } : null;
  };
  const seen = new Set<string>();
  const pending = new Map<Element, ReturnType<typeof setTimeout>>();
  // Nothing counts after cleanup (React mounts effects twice in development).
  let stopped = false;
  const io = new IntersectionObserver(
    (entries) => {
      if (stopped) return;
      for (const en of entries) {
        if (!en.isIntersecting) {
          clearTimeout(pending.get(en.target));
          pending.delete(en.target);
          continue;
        }
        if (pending.has(en.target)) continue;
        pending.set(
          en.target,
          setTimeout(() => {
            pending.delete(en.target);
            const f = facts(en.target);
            if (stopped || !f || seen.has(f.titleId)) return;
            seen.add(f.titleId);
            track({ page, shelf, slot: f.slot, onServer: f.onServer, event: "impression" });
          }, 1000),
        );
      }
    },
    { threshold: 0.6 },
  );
  const watch = () => {
    for (const el of scroller.children) io.observe(el);
  };
  watch();
  const mo = new MutationObserver(watch);
  mo.observe(scroller, { childList: true });
  const onClick = (e: MouseEvent) => {
    // The card's link opens the title; its "More" button or a toggle on it does not.
    if (!(e.target as Element).closest?.("a[data-title-id]")) return;
    const el = [...scroller.children].find((c) => c.contains(e.target as Node));
    const f = el ? facts(el) : null;
    if (!f) return;
    track({ page, shelf, slot: f.slot, onServer: f.onServer, event: "open" });
    opens.set(f.titleId, { page, shelf, slot: f.slot, onServer: f.onServer, at: Date.now(), done: [] });
  };
  scroller.addEventListener("click", onClick);
  return () => {
    stopped = true;
    io.disconnect();
    mo.disconnect();
    for (const t of pending.values()) clearTimeout(t);
    scroller.removeEventListener("click", onClick);
  };
}

/** A watchlist add or a play of a title opened from a shelf in the last 30 minutes counts for that shelf, once. */
export function trackOutcome(titleId: string, event: "watchlist" | "play") {
  const o = opens.get(titleId);
  if (!o || Date.now() - o.at > ATTRIBUTION_MS || o.done.includes(event)) return;
  o.done.push(event);
  track({ page: o.page, shelf: o.shelf, slot: o.slot, onServer: o.onServer, event });
}
