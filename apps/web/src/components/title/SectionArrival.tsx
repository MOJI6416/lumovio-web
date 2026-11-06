"use client";

import { useEffect } from "react";
import { TITLE_SECTIONS } from "./core";

/** Anything the person does that says they took over the scroll. */
const TAKE_OVER = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/**
 * Opens the section a link asked for (9, Title): `?tab=episodes` and the other tabs' addresses of before 2026-11 (the
 * calendar, the library, the player) and `#episodes` (a card's "Mark episodes"). The section comes to the top at once;
 * while the parts above it settle (where to watch, the shelves) it is kept there, until the person scrolls or 3 s pass.
 * The address loses the old parameter, so Back to this page returns to where it was left, not to the section again.
 * `#ratings` and `#lumovio-score` are the ratings' own (./RatingsSection). Renders nothing.
 */
export function SectionArrival() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const tab = url.searchParams.get("tab");
    const hash = url.hash.slice(1);
    const asked = (TITLE_SECTIONS as readonly string[]).includes(hash) ? hash : tab && (TITLE_SECTIONS as readonly string[]).includes(tab) && !hash ? tab : null;
    if (tab !== null || asked === hash) {
      url.searchParams.delete("tab");
      if (asked && asked === hash) url.hash = "";
      window.history.replaceState(window.history.state, "", url);
    }
    const el = asked ? document.getElementById(asked) : null;
    if (!el) return;
    let done = false;
    const align = () => {
      if (!done) el.scrollIntoView({ block: "start" });
    };
    const ro = new ResizeObserver(align);
    const stop = () => {
      done = true;
      ro.disconnect();
      for (const e of TAKE_OVER) window.removeEventListener(e, stop);
    };
    align();
    ro.observe(document.body);
    for (const e of TAKE_OVER) window.addEventListener(e, stop, { passive: true });
    const timer = window.setTimeout(stop, 3000);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, []);
  return null;
}
