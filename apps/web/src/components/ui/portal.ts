"use client";

import { createContext, type RefObject, useContext, useLayoutEffect, useState } from "react";

/**
 * Where floating layers (select lists, combobox popovers…) are portalled. Normally `document.body`; a part of the
 * page that sets its own theme — the /dev/ui showcase — provides an element inside it, so the layer takes that
 * theme instead of the site's.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export const usePortalContainer = () => useContext(PortalContainerContext) ?? undefined;

/*
 * The stage (design-system 3.5) is dark in either theme. A layer portalled into the body would take the page's theme
 * — a light dialog over the dark sign-in wall or the player — so a layer opened from an element on a stage carries
 * the `stage` class itself and takes the same dark values. A layer portalled into another layer that is on a stage
 * inherits it the ordinary way.
 */

/** Forces the stage decision for the layers inside (the confirmation host knows where it was asked from). */
export const LayerStageContext = createContext<boolean | null>(null);

/** Whether `el` is on a stage: its nearest themed ancestor is a `.stage`, not a `[data-theme]` part of the page. */
export function isOnStage(el: Element | null | undefined) {
  return el?.closest(".stage, [data-theme]")?.classList.contains("stage") ?? false;
}

// Safari doesn't focus a button that was clicked: the last press stands in for the focus.
let lastPress: Element | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      lastPress = e.target instanceof Element ? e.target : null;
    },
    true,
  );
}

/** Where a layer opened from code (no trigger) comes from: the focused element, or the one pressed last. */
export function layerOrigin(): Element | null {
  const a = document.activeElement;
  if (a && a !== document.body) return a;
  return lastPress?.isConnected ? lastPress : null;
}

/**
 * For a layer with a trigger: true while it is open from a trigger on a stage (the class to add to its content).
 * Decided before the first paint of the open layer, so it never flashes in the page's theme.
 */
export function useOnStage(open: boolean, anchor: RefObject<Element | null>) {
  const forced = useContext(LayerStageContext);
  const [stage, setStage] = useState(false);
  useLayoutEffect(() => {
    if (open && forced === null) setStage(isOnStage(anchor.current ?? layerOrigin()));
  }, [open, forced, anchor]);
  return forced ?? stage;
}
