"use client";

import { createContext, useContext } from "react";
import { BACK_KEYCODES } from "@/lib/tv";
import type { Dir } from "./engine";

/*
 * The TV shell's navigation as the rest of the code sees it — the context and its type only, so a component shared
 * with the site (the player) can ask whether it runs in the TV shell without the site loading the shell's navigation.
 */

export interface NavApi {
  move: (dir: Dir) => boolean;
  back: () => void;
  /**
   * Opens a layer (dialog, menu, panel): an entry in the history, closed by Back or `dismiss`. `inline`: a state of the
   * screen itself (the player's controls, the sources over the player) — the focus isn't kept inside it nor moved back
   * when it closes, and the screen's own Back step goes before it.
   */
  openLayer: (close: () => void, opts?: { inline?: boolean }) => { id: number; dismiss: () => void };
  /** A screen's own step of Back (hide the player's controls…): return true when it handled it. Newest first. */
  onBack: (handler: () => boolean) => () => void;
  /** Goes to `href`, closing open layers first so no empty "back" steps stay behind. */
  navigate: (href: string, opts?: { replace?: boolean }) => void;
  /**
   * Leaves this screen for the one it was opened from (the history's previous entry), or — opened directly, with
   * nothing before it — replaces it with `fallback`. The player's way out: never a new entry Back would return from.
   */
  leave: (fallback: string) => void;
  /**
   * Changes the address's query for a state of the same screen (a grid's filters, a library tab): kept in the history
   * entry for Back (TV2), without the screen starting over at its first item.
   */
  replaceQuery: (query: URLSearchParams) => void;
  /** Focuses `el` and brings it into view. */
  focus: (el: HTMLElement | null | undefined, opts?: { reveal?: boolean }) => void;
  /** The screen's starting focus: `data-tv-initial`, else its first item. */
  focusStart: () => void;
}

export const NavContext = createContext<NavApi | null>(null);

/** The TV shell's navigation where there is one (a shared component on a TV), else null (the site). */
export function useTvNavOptional(): NavApi | null {
  return useContext(NavContext);
}

/** Back of a remote: Tizen's Return, webOS's Back, Escape, Backspace, and "GoBack" sent by the TV app (apps/tv-android). */
export const isBackKey = (e: KeyboardEvent) => BACK_KEYCODES.has(e.keyCode) || e.key === "GoBack" || e.key === "BrowserBack";
