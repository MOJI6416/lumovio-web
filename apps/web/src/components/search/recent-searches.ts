"use client";

import { useSyncExternalStore } from "react";

/*
 * Recent searches (design-system 9 "Search"): the last eight queries of this browser, shared by the header's search,
 * the search page and the TV's. A query goes in when a result is opened, Enter is pressed, or what it found stayed on
 * the page for a moment; the same text in another case replaces the older one. Every view sees a change at once (and
 * another tab of the site on its next "storage" event).
 */

const KEY = "lumovio.recentSearches";
const MAX = 8;
const NONE: string[] = [];
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    cache = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX) : NONE;
  } catch {
    cache = NONE;
  }
  return cache;
}

function write(list: string[]) {
  cache = list;
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the list still shows for this visit */
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY && e.key !== null) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const recentSearches = {
  push(q: string) {
    const v = q.trim();
    if (v.length < 2) return;
    write([v, ...read().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, MAX));
  },
  clear: () => write([]),
};

/** The recent searches, newest first (none while the page is drawn on the server). */
export function useRecentSearches(): string[] {
  return useSyncExternalStore(subscribe, read, () => NONE);
}
