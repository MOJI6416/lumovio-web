"use client";

import { useRouter as useNextRouter, usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { randomId } from "@/lib/random-id";
import { isBackKey, type NavApi, NavContext } from "./context";
import {
  applyShifts,
  type Dir,
  findByKey,
  findTarget,
  isUsable,
  itemsIn,
  itemsOf,
  KEY_DIR,
  keyOf,
  readShifts,
  reveal,
  type Shifts,
  ZoneMemory,
  zoneOf,
} from "./engine";

/*
 * The TV shell's navigation provider: arrows by zones (./engine), OK once per
 * press, Back by one step — the top layer, then what the screen defines, then the previous screen —, every layer an
 * entry in the history (so a TV browser that handles Back itself, without a keydown, still closes only the layer), and
 * the focus and slides of each screen kept for the way back.
 */

/** A screen's place: the home, a section of the menu, or something opened from them. */
export type ScreenLevel = "home" | "section" | "detail";

interface Layer {
  id: number;
  close: () => void;
  /** What had the focus when the layer opened: it gets it back. */
  opener: HTMLElement | null;
  /** Where the opener stood — its zone, key and place —, for when the layer took it away (a removed card). */
  from: { zone: string; key: string | null; index: number } | null;
  /** A state of the screen itself (the player's controls, the sources over the player): no box to keep the focus in. */
  inline: boolean;
  /** Its history entry exists (pushed only once the steps back already asked for have landed). */
  pushed: boolean;
  /** Dismissed: its step back is on the way. */
  leaving: boolean;
}

/** Where the focus goes back when a layer closes: its opener, else the same item in its zone, else the neighbour. */
function returnTarget(l: Layer): HTMLElement | null {
  const o = l.opener;
  if (o?.isConnected && isUsable(o)) return o;
  if (!l.from) return null;
  const zone = document.querySelector<HTMLElement>(`[data-zone="${CSS.escape(l.from.zone)}"]`);
  if (!zone) return null;
  const same = l.from.key ? findByKey(zone, l.from.key) : null;
  if (same && isUsable(same)) return same;
  const items = itemsOf(zone);
  return items[Math.min(Math.max(0, l.from.index), items.length - 1)] ?? null;
}

export type { NavApi } from "./context";
export { isBackKey, useTvNavOptional } from "./context";

export function useTvNav(): NavApi {
  const v = useContext(NavContext);
  if (!v) throw new Error("useTvNav outside TvNavProvider");
  return v;
}

const STORE = "tv.screen:";
const DEPTH = "tv.depth";

interface Saved {
  zone: string | null;
  key: string | null;
  zones: [string, string][];
  shifts: Shifts;
}

const session = {
  get<T>(k: string): T | null {
    try {
      const v = sessionStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      sessionStorage.setItem(k, JSON.stringify(v));
    } catch {
      // Private mode or full storage: Back then starts the screen at its beginning.
    }
  },
};

/** The address as the browser has it now, comparable with `usePathname()` + query. */
const here = () => {
  const raw = `${window.location.pathname}${window.location.search}`;
  try {
    return decodeURI(raw);
  } catch {
    return raw;
  }
};
const same = (a: string, b: string) => {
  try {
    return decodeURI(a) === decodeURI(b);
  } catch {
    return a === b;
  }
};

const typingIn = (el: Element | null) =>
  Boolean(
    el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable),
  );

/** Waits for `find` to return an element (data that arrives after the screen), up to `ms`. */
function whenPresent(
  find: () => HTMLElement | null,
  ms: number,
  then: (el: HTMLElement | null) => void,
): () => void {
  const now = find();
  if (now) {
    then(now);
    return () => {};
  }
  const obs = new MutationObserver(() => {
    const el = find();
    if (el) {
      done();
      then(el);
    }
  });
  const timer = window.setTimeout(() => {
    done();
    then(null);
  }, ms);
  const done = () => {
    obs.disconnect();
    window.clearTimeout(timer);
  };
  obs.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-key", "disabled", "inert"],
  });
  return done;
}

/** The repeat of a held arrow is paced: one step per this many ms at most, so a held key glides instead of racing. */
const REPEAT_MS = 70;
/** The focus resting this long on a link prefetches its screen. */
const PREFETCH_MS = 300;

export function TvNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const nextRouter = useNextRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const url = search ? `${pathname}?${search}` : pathname;

  const layers = useRef<Layer[]>([]);
  const backHandlers = useRef<(() => boolean)[]>([]);
  const memory = useRef(new ZoneMemory());
  const popped = useRef(false);
  /** The next address replaces this entry (no step deeper in the history). */
  const replacing = useRef(false);
  const lastMove = useRef(0);
  const seq = useRef(0);
  const urlRef = useRef(url);
  const saved = useRef(new Map<string, Saved>());
  const sameScreen = useRef(false);
  /** The last focused item outside the menu: → from the menu goes back to it. */
  const lastContent = useRef<HTMLElement | null>(null);
  /** Steps back asked for by `dismiss` that haven't landed yet: a layer opened meanwhile waits for them. */
  const backs = useRef(0);
  /** `leave` is going back past the open layers to the previous screen. */
  const away = useRef(false);

  /** Whose layer an entry is: a reload keeps `history.state`, so an entry an earlier page left with a layer's number
   * (its numbers start again from 1 here) is just a screen's — read as a layer's, it kept this page's layers open. */
  const doc = useRef("");
  const push = useCallback((l: Layer) => {
    l.pushed = true;
    doc.current ||= randomId();
    window.history.pushState({ ...(window.history.state as object), tvLayer: l.id, tvDoc: doc.current }, "");
  }, []);
  /** The history entries of the layers that are open and not on their way out. */
  const entries = useCallback(() => layers.current.filter((l) => l.pushed && !l.leaving).length, []);

  const scope = useCallback((): HTMLElement => {
    const top = layers.current.findLast((l) => !l.inline && !l.leaving);
    if (top) {
      // A TV layer, or a layer of a shared component (the player's panels) that keeps its own dialog.
      const own = document.querySelector<HTMLElement>(`[data-tv-layer="${top.id}"]`) ?? [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(isUsable).pop();
      if (own) return own;
    }
    return document.querySelector<HTMLElement>("[data-tv-root]") || document.body;
  }, []);

  /** The screen as it is now — focus, memory, slides — kept for the way back; refreshed on every focus. */
  const snapshot = useCallback(() => {
    const root = document.querySelector<HTMLElement>("[data-tv-root]");
    // While the address changes, the screen in the document is already the next one: nothing to keep for this one.
    if (!root || layers.current.length || !same(here(), urlRef.current)) return;
    const active = document.activeElement as HTMLElement | null;
    const zone = active && root.contains(active) ? zoneOf(active) : null;
    saved.current.set(urlRef.current, {
      zone: zone?.dataset.zone ?? null,
      key: active && zone ? keyOf(active) : null,
      zones: [...memory.current.last],
      shifts: readShifts(root),
    });
  }, []);

  // A page whose content grows or shrinks under the focus (a season's episodes arriving, a description loading) brings
  // the focused item back into view, so data arriving never leaves it under the edge.
  const resized = useRef<ResizeObserver | null>(null);
  const watchSize = useCallback((el: HTMLElement) => {
    const content = el.closest<HTMLElement>("[data-tv-content]");
    if (!content || typeof ResizeObserver === "undefined") return;
    resized.current ??= new ResizeObserver((entries) => {
      const active = document.activeElement as HTMLElement | null;
      if (active && entries.some((e) => e.target.contains(active))) reveal(active);
    });
    resized.current.observe(content);
  }, []);
  useEffect(() => () => resized.current?.disconnect(), []);

  const focus = useCallback<NavApi["focus"]>(
    (el, opts) => {
      if (!el) return;
      el.focus({ preventScroll: true });
      memory.current.remember(el);
      if (!el.closest('[data-zone="nav"]')) lastContent.current = el;
      if (opts?.reveal !== false) reveal(el);
      watchSize(el);
      snapshot();
    },
    [snapshot, watchSize],
  );

  /** The screen's first item: `data-tv-initial`, else the first in its content; `menu` allows the menu's. */
  const startItem = useCallback(
    (menu = true): HTMLElement | null => {
      const s = scope();
      const initial = [...s.querySelectorAll<HTMLElement>("[data-tv-initial]")].find(isUsable);
      if (initial) return initial;
      const main = s.querySelector<HTMLElement>("[data-tv-main]") ?? s;
      return itemsIn(main)[0] ?? (menu ? (itemsIn(s)[0] ?? null) : null);
    },
    [scope],
  );

  const focusStart = useCallback(() => focus(startItem()), [focus, startItem]);

  const move = useCallback(
    (dir: Dir): boolean => {
      const s = scope();
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body || !s.contains(active)) {
        // Nothing focused (the start, or the focused item disappeared): the screen's start, not a jump.
        focusStart();
        return true;
      }
      if (
        dir === (document.documentElement.dir === "rtl" ? "left" : "right") &&
        active.closest('[data-zone="nav"]')
      ) {
        // Out of the menu: back where the screen was, not to whatever lies to the right of the menu item.
        const last = lastContent.current;
        focus(last?.isConnected && s.contains(last) && isUsable(last) ? last : startItem(false));
        return true;
      }
      const res = findTarget(active, dir, s, memory.current);
      if (!res) return false;
      focus(res.target);
      return true;
    },
    [scope, focus, focusStart, startItem],
  );

  const navigate = useCallback<NavApi["navigate"]>(
    (href, opts) => {
      const go = () => {
        replacing.current = Boolean(opts?.replace);
        if (opts?.replace) router.replace(href);
        else router.push(href);
      };
      const open = entries();
      if (!open) return go();
      // Close the layers through the history first; navigate once they are gone.
      const onPop = () => {
        window.removeEventListener("popstate", onPop);
        go();
      };
      window.addEventListener("popstate", onPop);
      window.history.go(-open);
    },
    [router, entries],
  );

  const back = useCallback(() => {
    const top = layers.current.findLast((l) => !l.leaving);
    // An inline layer is a state of the screen: the screen's own step goes first (a preparation is cancelled).
    if (top && !top.inline) {
      window.history.back();
      return;
    }
    for (let i = backHandlers.current.length - 1; i >= 0; i--) if (backHandlers.current[i]!()) return;
    if (top) {
      window.history.back();
      return;
    }
    const screen = document.querySelector<HTMLElement>("[data-tv-screen]");
    const level = (screen?.dataset.tvScreen ?? "detail") as ScreenLevel;
    const nav = document.querySelector<HTMLElement>('[data-zone="nav"]');
    const inNav = Boolean(nav?.contains(document.activeElement));
    if (level !== "detail") {
      // Home and the menu's sections: Back first goes to the menu, then from a section to the home (Netflix's way); on
      // the home's menu the TV app asks whether to leave, a browser stays (never thrown out).
      if (!inNav && nav) {
        const current = nav.querySelector<HTMLElement>("[aria-current=page]") ?? itemsOf(nav)[0];
        focus(current, { reveal: false });
        return;
      }
      if (level === "section") return navigate("/", { replace: true });
      (window as { LumovioTV?: { exitPrompt?: () => void } }).LumovioTV?.exitPrompt?.();
      return;
    }
    const depth = session.get<number>(DEPTH) ?? 0;
    if (depth > 0) window.history.back();
    else navigate("/", { replace: true });
  }, [focus, navigate]);

  const leave = useCallback<NavApi["leave"]>(
    (fallback) => {
      if ((session.get<number>(DEPTH) ?? 0) > 0) {
        // Past the entries of the layers still open (the player's controls): one step to the previous screen.
        away.current = true;
        window.history.go(-(entries() + 1));
      } else navigate(fallback, { replace: true });
    },
    [navigate, entries],
  );

  const replaceQuery = useCallback<NavApi["replaceQuery"]>((query) => {
    const q = query.toString();
    sameScreen.current = true;
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, []);

  const openLayer = useCallback<NavApi["openLayer"]>((close, opts) => {
    const id = ++seq.current;
    const opener = document.activeElement as HTMLElement | null;
    const zone = opener ? zoneOf(opener) : null;
    const from =
      opener && zone?.dataset.zone
        ? { zone: zone.dataset.zone, key: keyOf(opener), index: itemsOf(zone).indexOf(opener) }
        : null;
    const layer: Layer = { id, close, opener, from, inline: Boolean(opts?.inline), pushed: false, leaving: false };
    layers.current.push(layer);
    // A step back still on its way (a layer dismissed in the same moment) would land on this entry: it waits for it.
    if (!backs.current) push(layer);
    return {
      id,
      dismiss: () => {
        if (!layers.current.includes(layer) || layer.leaving) return;
        if (!layer.pushed) {
          // Never in the history: gone at once.
          layers.current = layers.current.filter((l) => l !== layer);
          layer.close();
          return;
        }
        layer.leaving = true;
        backs.current++;
        window.history.back();
      },
    };
  }, [push]);

  const onBack = useCallback<NavApi["onBack"]>((handler) => {
    backHandlers.current.push(handler);
    return () => {
      backHandlers.current = backHandlers.current.filter((h) => h !== handler);
    };
  }, []);

  // The history: a step back past a layer's entry closes it (Back of the TV browser itself, or `dismiss`).
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = e.state as { tvLayer?: number; tvDoc?: string } | null;
      const at = s?.tvDoc === doc.current ? (s.tvLayer ?? 0) : 0;
      if (backs.current) backs.current--;
      // `leave`: past the layers to the previous screen — they close with this one, nothing to give the focus back to.
      const left = away.current;
      away.current = false;
      let closed: Layer | null = null;
      for (let i = layers.current.length - 1; i >= 0; i--) {
        const l = layers.current[i]!;
        if (!l.pushed || (l.id <= at && !left)) continue;
        layers.current.splice(i, 1);
        l.close();
        closed = l;
      }
      // Layers opened while a step back was on its way get their entries now (and keep the focus they took).
      let opened = false;
      if (!backs.current)
        for (const l of layers.current)
          if (!l.pushed) {
            push(l);
            opened = true;
          }
      if (left) {
        popped.current = true;
        return;
      }
      if (closed) {
        const layer = closed;
        // An inline layer leaves the focus to its screen (the player puts it on the picture).
        if (layer.inline || opened) return;
        // After React removed the layer: back on what opened it (or where it stood), else the screen's start.
        requestAnimationFrame(() => {
          const el = returnTarget(layer);
          if (el) focus(el, { reveal: el !== layer.opener });
          else focusStart();
        });
        return;
      }
      if (!at) popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [focus, focusStart, push]);

  // Keys of the remote. Bubbling: a control that handles an arrow itself (a text field, a slider) says so with
  // preventDefault and the shell leaves it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const typing = typingIn(active);
      if (isBackKey(e)) {
        if (e.defaultPrevented || (typing && e.keyCode === 8)) return;
        e.preventDefault();
        if (!e.repeat) back();
        return;
      }
      if (e.key === "Enter" && e.repeat) {
        // OK held down activates once.
        e.preventDefault();
        return;
      }
      const dir = KEY_DIR[e.key];
      if (!dir || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (typing && (dir === "left" || dir === "right") && (active as HTMLInputElement).value) return;
      e.preventDefault();
      const now = performance.now();
      if (e.repeat && now - lastMove.current < REPEAT_MS) return;
      lastMove.current = now;
      move(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, move]);

  // LG's Magic Remote is a pointer: the item under it is the selection, and the arrows go on from there.
  // Only a real movement counts — a shelf sliding under a still pointer doesn't move the focus.
  // The wheel steps.
  useEffect(() => {
    let wheelAt = 0;
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch" || (!e.movementX && !e.movementY)) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "a[href], button, [tabindex], [data-tv-focus]",
      );
      if (!el || el === document.activeElement || !scope().contains(el) || !isUsable(el)) return;
      focus(el, { reveal: false });
    };
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now - wheelAt < 160 || Math.abs(e.deltaY) < 4) return;
      wheelAt = now;
      move(e.deltaY > 0 ? "down" : "up");
    };
    document.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onPointer);
      document.removeEventListener("wheel", onWheel);
    };
  }, [focus, move, scope]);

  // Memory: every focus inside a zone is remembered; a focused item that disappears (a list refreshed) hands the focus
  // to its neighbour in the same zone instead of losing it to the page.
  useEffect(() => {
    const onIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (zoneOf(el)) memory.current.remember(el);
    };
    const onOut = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      const zone = zoneOf(el);
      if (!zone || e.relatedTarget) return;
      const index = itemsOf(zone).indexOf(el);
      requestAnimationFrame(() => {
        if (el.isConnected || (document.activeElement && document.activeElement !== document.body)) return;
        // Gone because the screen is changing: the next screen sets its own focus.
        if (!same(here(), urlRef.current)) return;
        const items = zone.isConnected ? itemsOf(zone) : [];
        const next = items[Math.min(Math.max(0, index), items.length - 1)];
        if (next) focus(next);
        else focusStart();
      });
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, [focus, focusStart]);

  // Links don't prefetch for being on screen (`prefetch={false}` across the shell: Next's visibility observer over
  // hundreds of cards was recomputed in every frame of a slide on a TCL TV); the link the focus rests on is
  // prefetched instead, so OK still opens its screen at once. The anchor's href is already the locale's.
  useEffect(() => {
    let rest: ReturnType<typeof setTimeout> | undefined;
    const onIn = (e: FocusEvent) => {
      clearTimeout(rest);
      const a = e.target;
      if (!(a instanceof HTMLAnchorElement) || a.origin !== window.location.origin) return;
      const href = a.getAttribute("href");
      if (href) rest = setTimeout(() => nextRouter.prefetch(href), PREFETCH_MS);
    };
    document.addEventListener("focusin", onIn);
    return () => {
      clearTimeout(rest);
      document.removeEventListener("focusin", onIn);
    };
  }, [nextRouter]);

  // Each screen: on the way back its focus and slides come back; otherwise it starts at its start.
  // The snapshots live in memory and, for a reload, in sessionStorage.
  useEffect(() => {
    const prev = urlRef.current;
    if (sameScreen.current) {
      // The same screen in another state (replaceQuery): its memory goes on under the new address.
      sameScreen.current = false;
      const last = saved.current.get(prev);
      if (last) saved.current.set(url, last);
      urlRef.current = url;
      return;
    }
    if (prev !== url) {
      const last = saved.current.get(prev);
      if (last) session.set(STORE + prev, last);
      urlRef.current = url;
      const depth = session.get<number>(DEPTH) ?? 0;
      session.set(DEPTH, popped.current ? Math.max(0, depth - 1) : replacing.current ? depth : depth + 1);
    }
    replacing.current = false;
    const back = popped.current;
    popped.current = false;
    layers.current = [];
    const state = back ? (saved.current.get(url) ?? session.get<Saved>(STORE + url)) : null;
    memory.current = new ZoneMemory();
    if (state) for (const [z, k] of state.zones) memory.current.last.set(z, k);
    const root = document.querySelector<HTMLElement>("[data-tv-root]") ?? document.body;
    return whenPresent(
      () => {
        if (state?.zone && state.key) {
          const zone = root.querySelector<HTMLElement>(`[data-zone="${CSS.escape(state.zone)}"]`);
          return zone ? findByKey(zone, state.key) : null;
        }
        // The start item still loading (`data-tv-initial-pending`): wait for it rather than start on whatever is
        // focusable meanwhile — a title's "Trailer" kept the focus once "Resume" appeared.
        return root.querySelector("[data-tv-initial-pending]") ? null : startItem(false);
      },
      state ? 2500 : 4000,
      (el) => {
        if (state) applyShifts(root, state.shifts);
        if (el) focus(el, { reveal: !state });
        else if (!document.activeElement || document.activeElement === document.body) focusStart();
      },
    );
  }, [url, focus, focusStart, startItem]);

  useEffect(() => {
    const onHide = () => {
      snapshot();
      const last = saved.current.get(urlRef.current);
      if (last) session.set(STORE + urlRef.current, last);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [snapshot]);

  const api = useMemo<NavApi>(
    () => ({ move, back, openLayer, onBack, navigate, leave, replaceQuery, focus, focusStart }),
    [move, back, openLayer, onBack, navigate, leave, replaceQuery, focus, focusStart],
  );
  return <NavContext.Provider value={api}>{children}</NavContext.Provider>;
}

/** Registers a screen's own Back step while mounted. */
export function useTvBack(handler: () => boolean, on = true) {
  const { onBack } = useTvNav();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => (on ? onBack(() => ref.current()) : undefined), [onBack, on]);
}
