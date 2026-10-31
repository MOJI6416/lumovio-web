"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while the server's HTML is being hydrated, true from then on. A tab's code arrives after the hero's, whose
 * requests (availability, library state, ratings) may already be in the cache by then: until hydration ends, a tab
 * draws what the server drew (its loading state), so the two match.
 */
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);
