"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useState, useSyncExternalStore } from "react";

/*
 * Shared behaviour of the floating layers (design-system 7.8–7.10): menus, popovers, dialogs, sheets and toasts. Where a layer is portalled lives in ./portal (part 1 of Ф1); this file holds the rest.
 */

/** Phones (< md, where the bottom tab bar is): menus and popovers open as a bottom sheet (7.8, 7.9, 10.1). */
const PHONE_QUERY = "(width < 48rem)";

function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True on a phone-width screen. The server and the first client render say false (the desktop layout). */
export function usePhoneLayout() {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/**
 * A TV remote's Back closes the top layer, as Escape does (10.3): Tizen 10009, webOS 461, and Backspace in TV mode
 * when no field is being typed in. The caller closes the layer and calls `preventDefault()`, so the TV navigation
 * (components/tvui/nav/TvNav) sees the key handled and doesn't go back in history.
 */
export function isLayerBackKey(e: ReactKeyboardEvent | KeyboardEvent) {
  if (e.keyCode === 10009 || e.keyCode === 461) return true;
  if (e.key !== "Backspace" || document.documentElement.dataset.tv !== "1") return false;
  const t = e.target as HTMLElement | null;
  return !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable));
}

/** Marks the toast region; a modal layer doesn't treat a press on a toast ("Undo") as a press outside itself. */
export const TOAST_REGION_ATTR = "data-toast-region";

export function isInToastRegion(target: EventTarget | null) {
  return target instanceof Element && target.closest(`[${TOAST_REGION_ATTR}]`) !== null;
}

// Radix decides "outside" on the click that follows the pointerdown; by then the toast that was pressed may be gone
// from the DOM (its action closes it), so the press is remembered when it starts.
const toastPresses = new WeakSet<Event>();

/** The toast region calls this for every pointerdown inside it. */
export function markToastPress(e: Event) {
  toastPresses.add(e);
}

/** Whether a layer's outside pointerdown started on a toast. */
export function isToastPress(e: Event) {
  return toastPresses.has(e) || isInToastRegion(e.target);
}

/** Where the focus was when a layer opened, to give it back on close (8.9, audit SRC-17). */
export interface FocusOrigin {
  el: HTMLElement | null;
  /** The trigger of the menu or sheet the focused element was in: a menu item is gone once its menu closes. */
  trigger: HTMLElement | null;
}

// The trigger of each open menu / sheet / popover content, registered by the layer itself: a trigger's
// aria-controls is gone already when a dialog opened from an item of a closing sheet reads it.
const layerTriggers = new WeakMap<Element, HTMLElement>();

/** A layer with a trigger calls this from its content's ref. */
export function rememberLayerTrigger(content: Element | null, trigger: HTMLElement | null) {
  if (content && trigger) layerTriggers.set(content, trigger);
}

export function captureFocus(): FocusOrigin {
  const el =
    document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null;
  const layer = el?.closest<HTMLElement>("[role=menu],[role=dialog]");
  // Radix triggers also point at their open layer with aria-controls.
  const trigger =
    (layer && layerTriggers.get(layer)) ??
    (layer?.id ? document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(layer.id)}"]`) : null);
  return { el, trigger };
}

// Whether the last input was a pointer (mouse, touch, pen) rather than a key. Radix's menu and select triggers take no
// focus from the mouse, so on a first visit, before any click has focused something, Chrome rings whatever focus a
// script moves — the trigger focused again as its menu closes too (owner, 2026-10-29: a ring round the avatar after
// the account menu, gone after the first link). Layers give the focus back with `focusBack`.
let pointerLast = false;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => (pointerLast = true), true);
  window.addEventListener("keydown", () => (pointerLast = false), true);
}

/** Gives a layer's focus back to `el`: with the keyboard's ring after a key, without it after a pointer. */
export function focusBack(el: HTMLElement) {
  el.focus({ preventScroll: true, ...(pointerLast && { focusVisible: false }) });
}

/** Focuses where the layer was opened from; false when neither the element nor its menu's trigger is still there. */
export function restoreFocus(origin: FocusOrigin | null) {
  for (const el of [origin?.el, origin?.trigger]) {
    if (el?.isConnected && !el.closest("[inert]")) {
      focusBack(el);
      if (document.activeElement === el) return true;
    }
  }
  return false;
}

/** `open`/`onOpenChange` when the caller controls the layer, its own state otherwise (a layer with a trigger). */
export function useOpenState(
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
  defaultOpen = false,
) {
  const [own, setOwn] = useState(defaultOpen);
  const controlled = open !== undefined;
  const value = controlled ? open : own;
  const set = useCallback(
    (next: boolean) => {
      if (!controlled) setOwn(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );
  return [value, set] as const;
}
