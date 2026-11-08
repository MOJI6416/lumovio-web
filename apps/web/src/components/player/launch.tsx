"use client";

import { usePathname } from "next/navigation";
import { type ComponentType, type ReactNode, useEffect, useReducer, useState, useSyncExternalStore } from "react";

/*
 * The launch of a viewing (design-system 11.1 «Запуск»): from the press of "Watch" — anywhere: the title's hero, "Where
 * to watch" and its details, "Continue" on home, the sources screen, the next episode — to the film's first frame, one
 * scene: the black stage, the brand's loader with what is being done now in a few words, and nothing else. It comes the
 * moment "Watch" is pressed (a link to the player too) and stays over the navigation to the player, its preparation and
 * the player's first loading, so no page, theme colour or other loader shows between; it goes when the first frame does.
 *
 * One host (LaunchHost, in the locale's layout) draws it; whoever drives a launch only says what is going on. Every page
 * carries the host, so it holds only the store, the black and the press; the words, the loader and the buttons
 * (./launch-scene) come in their own chunk, fetched once the page is idle.
 */

export interface LaunchScene {
  /**
   * What is being done now ("Adding the release to your TorrServer"); null: "Preparing playback…"; left out: the words
   * already shown stay (the player's page loading after an add on the title page).
   */
  status?: string | null;
  /** One line under it: the copy being started, a torrent's peers and speed. */
  detail?: string | null;
  /** Ways out when it takes a while ("Another source", "Back to watching"); shown after a few seconds. */
  actions?: ReactNode;
  /** "←" (with its name): to the title, or a cancel. */
  onBack?: (() => void) | null;
  backLabel?: string | null;
}

interface State {
  open: boolean;
  scene: LaunchScene;
  /** When this launch began (performance.now): the delayed parts count from it, across the pages it passes. */
  since: number;
  /** The page it began on: a launch that ends up on another page but the player's is over. */
  from: string;
  /** A page drives it (the player's page, or an add before it): no time limit then. */
  driven: boolean;
}

let state: State = { open: false, scene: {}, since: 0, from: "", driven: false };
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};
let closing = 0;

const begin = (next: LaunchScene, driven: boolean) => {
  cancelAnimationFrame(closing);
  const scene = state.open && next.status === undefined ? { ...next, status: state.scene.status } : next;
  state = state.open ? { ...state, scene, driven } : { open: true, scene, since: performance.now(), from: location.pathname, driven };
  emit();
};

/**
 * A launch begins at a press: the black stage at once. `driven`: the caller says what it does and ends it itself (an
 * add on the title page before the player's page); a bare link's launch is driven by the player's page once it is there.
 */
export function startLaunch(scene: LaunchScene = {}, driven = false) {
  begin(scene, driven);
}

/** What the launch is doing now; opens it if it isn't (the player's page driving it). */
export function setLaunch(scene: LaunchScene) {
  begin(scene, true);
}

/**
 * The launch is over (the first frame, a failure, the sources screen). A frame later, so the next episode's launch,
 * begun as the last one's page goes, keeps the scene instead of closing and opening it.
 */
export function endLaunch() {
  cancelAnimationFrame(closing);
  closing = requestAnimationFrame(() => {
    if (!state.open) return;
    state = { ...state, open: false };
    emit();
  });
}

export function isLaunching() {
  return state.open;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => state;

/**
 * A page drives the launch while `scene` is given, and ends it when it is null or the page goes (the player's page:
 * from its first render to the first frame).
 */
export function useLaunch(scene: LaunchScene | null) {
  const on = scene !== null;
  useEffect(() => {
    if (scene) setLaunch(scene);
  });
  useEffect(() => {
    if (!on) endLaunch();
    return () => {
      if (on) endLaunch();
    };
  }, [on]);
}

/** A press on a link into the player ("Watch", "Continue", an episode's play) — not the sources screen (?pick=1). */
const WATCH = /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?watch\/(?:movie|tv)\/\d+/;
function watchLink(e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return false;
  const u = new URL(a.href, location.href);
  return u.origin === location.origin && WATCH.test(u.pathname) && u.searchParams.get("pick") !== "1";
}

// Fetched once, into a variable (React.lazy would draw nothing for a moment on its first use even when it is loaded).
let Content: ComponentType<{ scene: LaunchScene; since: number }> | null = null;
let loading: Promise<void> | null = null;
const loadScene = () => {
  loading ??= import("./launch-scene").then((m) => {
    Content = m.default;
  });
  return loading;
};

/**
 * The launch's one scene, drawn once for the whole site (not in the TV shell, which has its own: TV document §6). A link
 * into the player starts it by itself; the player's page then says what it does (WatchView). A launch that doesn't reach
 * the player (the link went nowhere, the page failed) ends by itself.
 */
export function LaunchHost() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [, loaded] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (s.open && !Content) void loadScene().then(loaded);
  }, [s.open]);
  const path = usePathname();
  // Kept a moment after the end, fading out over the first frame (and unmounted then).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (s.open) {
      setShown(true);
      return;
    }
    const id = window.setTimeout(() => setShown(false), 320);
    return () => window.clearTimeout(id);
  }, [s.open]);

  // A link into the player starts the launch at the press — before the page is asked for.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (document.documentElement.dataset.tv === "1" || !watchLink(e)) return;
      startLaunch();
    };
    // Capture: before the link's own handler (Next's Link prevents the default to navigate itself).
    document.addEventListener("click", click, true);
    // What the scene says, ready before the first press needs it (not on a TV).
    const idle = window.setTimeout(() => {
      if (document.documentElement.dataset.tv !== "1") void loadScene();
    }, 2000);
    return () => {
      document.removeEventListener("click", click, true);
      window.clearTimeout(idle);
    };
  }, []);

  // Undriven (a bare link's): not on the player's page after 10 s — the link led nowhere — or on the player's page with
  // nothing driving it after 6 s — the page failed: over. On another page than the one it began on: over.
  const onWatch = WATCH.test(path);
  useEffect(() => {
    if (!s.open || s.driven) return;
    const id = window.setTimeout(endLaunch, onWatch ? 6000 : 10_000);
    return () => window.clearTimeout(id);
  }, [s.open, s.driven, onWatch]);
  useEffect(() => {
    if (s.open && !onWatch && path !== s.from) endLaunch();
  }, [path, onWatch, s.from, s.open]);

  if (!s.open && !shown) return null;
  return (
    <div
      data-launch-stage
      aria-busy={s.open || undefined}
      className={`stage fixed inset-0 z-dialog bg-stage text-text-1 transition-opacity duration-slow ease-slow ${s.open ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      {/* The black comes with the press; what it says is loaded after the page (it shows from --loader-delay on). */}
      {Content && <Content scene={s.scene} since={s.since} />}
    </div>
  );
}
