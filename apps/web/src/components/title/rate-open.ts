"use client";

import { useSyncExternalStore } from "react";

/*
 * Which title's rating dialog is open. The rating sits with the hero's ratings (./YourRating) and the guest's action
 * is replayed by the actions after signing in (./TitleActions): both reach the one dialog through this.
 */
let open: string | null = null;
const listeners = new Set<() => void>();

export function setRateOpen(titleId: string | null) {
  open = titleId;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useRateOpen = (titleId: string) =>
  useSyncExternalStore(
    subscribe,
    () => open === titleId,
    () => false,
  );
