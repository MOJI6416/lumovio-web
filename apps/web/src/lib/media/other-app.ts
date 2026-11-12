"use client";

import { useSyncExternalStore } from "react";

/*
 * "Always play in another app": on this device "Watch" leads to the card with this device's apps (VLC, Infuse, a
 * playlist) instead of the player. The apps are the device's, not the profile's, so the choice is kept in this browser.
 * Every view sees a change at once (another tab of the site on its "storage" event).
 */

const KEY = "lumovio.player.otherApp";
const listeners = new Set<() => void>();

export function otherAppDefault(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setOtherAppDefault(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: nothing is kept */
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether this device plays in another app by default (off while the page is drawn on the server). */
export function useOtherAppDefault(): boolean {
  return useSyncExternalStore(subscribe, otherAppDefault, () => false);
}
