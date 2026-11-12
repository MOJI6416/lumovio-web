"use client";

import type { SpoilerPrefs } from "@lumovio/contracts";
import { useSession } from "@/components/providers/Providers";

/**
 * contracts' SPOILER_DEFAULTS, kept here: a value import from the contracts package brings its zod schemas into the
 * calendar's and the player's first load (bundle budget).
 */
const DEFAULTS: SpoilerPrefs = { stills: true, overviews: true, names: false };

/** What the active profile hides of unwatched episodes; a guest gets the defaults. */
export function useSpoilerPrefs(): SpoilerPrefs {
  const { me } = useSession();
  return me?.activeProfile?.spoilers ?? DEFAULTS;
}
