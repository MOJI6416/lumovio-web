"use client";

import { usePathname } from "@/i18n/navigation";
import type { TitleTabId } from "./core";

/** The element the tab row of a title sits in, scrolled to when another part of the page opens a tab. */
export const TABS_ANCHOR = "title-tabs";

/** Brings the tab row into view (without motion when reduced motion is asked for). */
export function scrollToTabs() {
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(TABS_ANCHOR)?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
}

/**
 * The address of a tab of this title, for a link from elsewhere on the page ("Where to watch" under the hero): opened
 * as LinkTabs opens it (`replace`, no scroll — Back leaves the title rather than stepping through tabs), with
 * `scrollToTabs` on click.
 */
export function useOpenTab() {
  const pathname = usePathname();
  return { href: (id: TitleTabId) => `${pathname}?tab=${id}` };
}
