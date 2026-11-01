"use client";

import { type KeyboardEvent, type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";
import { afterPageLoad } from "@/lib/page-load";

/*
 * Select and Combobox are on many first screens (filters, settings), while their lists (Radix Select / Popover and
 * the positioning engine) are needed only once someone opens one. So the field is drawn by a light button with the
 * same look, and the full control loads when the pointer comes near it or it gets the focus, then takes its place —
 * open already, if it was pressed (or Enter / Space / an arrow was pressed) before it arrived, and focused, if the
 * light button was. The light one stays until someone reaches for it also once the module is loaded: swapping every
 * mounted one at once cost Library → Ratings ~0.7 s of one long task per "Show more" (60 rows, 60 Radix Selects, 4×
 * CPU). A page that shows one also fetches it when the browser is idle, so it's usually there before anyone reaches
 * for it — without being first-load JS.
 */

/**
 * Fetches the module once the page has settled: after it has loaded (lib/page-load — not beside the first screen's
 * images on a slow network), then when idle, or 2 s later at the latest.
 */
export function useIdlePrefetch(control: { load: () => Promise<unknown> }) {
  useEffect(() => {
    let cancel = () => {};
    const stop = afterPageLoad(() => {
      const go = () => void control.load();
      if ("requestIdleCallback" in window) {
        const id = requestIdleCallback(go, { timeout: 2000 });
        cancel = () => cancelIdleCallback(id);
      } else {
        const id = setTimeout(go, 1500);
        cancel = () => clearTimeout(id);
      }
    });
    return () => {
      stop();
      cancel();
    };
  }, [control]);
}

export interface LazyControl<M> {
  /** Starts loading (once); resolves with the module. */
  load: () => Promise<M>;
  /** The module, once loaded. */
  loaded: () => M | null;
}

export function lazyControl<M>(importer: () => Promise<M>): LazyControl<M> {
  let mod: M | null = null;
  let pending: Promise<M> | null = null;
  return {
    load: () => {
      pending ??= importer().then((m) => {
        mod = m;
        return m;
      });
      return pending;
    },
    loaded: () => mod,
  };
}

/** Keys that open a closed select or combobox. */
export const OPEN_KEYS = ["Enter", " ", "ArrowDown", "ArrowUp"];

/**
 * The light stand-in's side: `full` is the module once it should take over, `start` says whether it opens and takes
 * the focus at once, `activate(open)` goes for it. It is the stand-in until `activate` (as on the server).
 */
export function useLazySwap<M>(control: LazyControl<M>, light: RefObject<HTMLElement | null>) {
  const [full, setFull] = useState<M | null>(null);
  const start = useRef({ open: false, focus: false });
  useIdlePrefetch(control);
  const activate = (open: boolean) => {
    if (open) start.current.open = true;
    void control.load().then((m) => {
      start.current.focus ||= light.current !== null && document.activeElement === light.current;
      setFull(() => m);
    });
  };
  return { full, start: start.current, activate };
}

/**
 * The stand-in's handlers: it loads the full part when the pointer comes near, it gets the focus or is pressed, and
 * asks for it open on the click (or Enter / Space / an arrow).
 *
 * The stand-in stays while it is being pressed: a part that arrived between pointer-down and pointer-up would take
 * the button's place, and the rest of the press would land on another element — the browser then sends the click
 * nowhere (nothing opens), or a touch's mouse events focus and click the new trigger, which closes what just opened
 * and takes the focus from its search field (X-41). A touch that turns into a scroll asks for nothing.
 */
export function useStandIn<M>(swap: { full: M | null; activate: (open: boolean) => void }) {
  const [held, setHeld] = useState(false);
  return {
    full: held ? null : swap.full,
    handlers: {
      onPointerEnter: () => swap.activate(false),
      onFocus: () => swap.activate(false),
      onPointerDown: (e: PointerEvent) => {
        if (e.button === 0) setHeld(true);
        swap.activate(false);
      },
      // After the click that follows it (same task), or for a press that ended elsewhere.
      onPointerUp: () => setTimeout(() => setHeld(false), 0),
      onPointerCancel: () => setHeld(false),
      onClick: () => {
        swap.activate(true);
        setHeld(false);
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (!OPEN_KEYS.includes(e.key)) return;
        e.preventDefault();
        swap.activate(true);
      },
    },
  };
}
