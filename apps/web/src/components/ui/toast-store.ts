/*
 * The toast queue, kept apart from React so its rules are unit-tested
 * (apps/web/test/toast-store.test.ts): at most 3 at once (a fourth pushes the oldest out); 4 s, or 7 s with an
 * action or for an error; the timers stop while the pointer is over the toasts or the focus is in them, and go on
 * with the time that was left.
 */

import type { ActionMarkKind } from "./BrandMotion";

export type ToastTone = "success" | "error" | "info";

export interface ToastAction {
  /** "Undo", "Open" — a verb. */
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** One follow-up; the toast stays 7 s and closes when it is used. */
  action?: ToastAction;
  /** The confirmed action's own mark instead of the tone's icon ("Added to Favourites": the heart). */
  icon?: ActionMarkKind;
}

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
  icon?: ActionMarkKind;
}

export const TOAST_LIMIT = 3;
export const TOAST_SHORT_MS = 4000;
export const TOAST_LONG_MS = 7000;

export const toastDuration = (t: Pick<ToastItem, "tone" | "action">) =>
  t.tone === "error" || t.action ? TOAST_LONG_MS : TOAST_SHORT_MS;

/** Why the timers are on hold; each is released on its own. */
export type ToastHold = "hover" | "focus";

export interface Clock {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
}

const realClock: Clock = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export function createToastStore(clock: Clock = realClock) {
  let items: ToastItem[] = [];
  let seq = 0;
  const timers = new Map<number, { left: number; started: number; handle?: unknown }>();
  const holds = new Set<ToastHold>();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };

  const start = (id: number) => {
    const t = timers.get(id);
    if (!t || t.handle !== undefined || holds.size > 0) return;
    t.started = clock.now();
    t.handle = clock.setTimeout(() => dismiss(id), t.left);
  };
  const stop = (id: number) => {
    const t = timers.get(id);
    if (!t || t.handle === undefined) return;
    clock.clearTimeout(t.handle);
    t.handle = undefined;
    t.left = Math.max(0, t.left - (clock.now() - t.started));
  };
  const forget = (id: number) => {
    stop(id);
    timers.delete(id);
  };

  function dismiss(id: number) {
    forget(id);
    const next = items.filter((x) => x.id !== id);
    if (next.length === items.length) return;
    items = next;
    emit();
  }

  return {
    push(tone: ToastTone, message: string, options: ToastOptions = {}) {
      const item: ToastItem = { id: ++seq, tone, message, action: options.action, icon: options.icon };
      items = [...items, item];
      while (items.length > TOAST_LIMIT) {
        const [oldest, ...rest] = items;
        if (oldest) forget(oldest.id);
        items = rest;
      }
      timers.set(item.id, { left: toastDuration(item), started: 0 });
      start(item.id);
      emit();
      return item.id;
    },
    dismiss,
    /** Runs the toast's action and closes it. */
    act(id: number) {
      const item = items.find((x) => x.id === id);
      dismiss(id);
      item?.action?.onClick();
    },
    hold(reason: ToastHold) {
      if (holds.has(reason)) return;
      holds.add(reason);
      if (holds.size === 1) for (const x of items) stop(x.id);
    },
    release(reason: ToastHold) {
      if (!holds.delete(reason) || holds.size > 0) return;
      for (const x of items) start(x.id);
    },
    getSnapshot: () => items,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ToastStore = ReturnType<typeof createToastStore>;

/** The app's one queue; `toast` in ./Toast pushes into it and `Toaster` shows it. */
export const toastStore = createToastStore();
