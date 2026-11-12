"use client";

import type { TitleAvailability } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/providers/Providers";
import { api } from "@/lib/api";
import { type CopyFilter, watchState } from "@/lib/watch-state";

/** What the API answers a guest for any title: no servers to look on. */
const GUEST: TitleAvailability = { servers: [], connections: 0, sources: [] };

/**
 * Personal data: the profile is part of the key, so nothing is served across profiles. A guest's answer is known without
 * asking, so the server's HTML already has the title's final actions (no "Checking…" that changes after the page shows).
 * `holds`: which copies count — a series' season's (`seasonCopies` in lib/media/packs; `titleCopies`).
 */
export function useTitleAvailability(titleId: string, holds: CopyFilter | null = null) {
  const { me } = useSession();
  const profile = me?.activeProfile?.id ?? null;
  const query = useQuery({
    queryKey: ["availability", titleId, profile],
    queryFn: () => api<TitleAvailability>(`/api/availability/${titleId}`),
    staleTime: 60_000,
    enabled: profile !== null,
    initialData: profile === null ? GUEST : undefined,
  });
  return { ...query, state: watchState(query.data, { signedIn: profile !== null, failed: query.isError, holds }) };
}

/** One request for a whole shelf: which titles can be played now from the profile's own servers. */
export function usePlayable(titleIds: string[]) {
  const { me } = useSession();
  const profile = me?.activeProfile?.id ?? null;
  return useQuery({
    queryKey: ["playable", profile, titleIds.join(",")],
    queryFn: () => api<{ playable: Record<string, "server"> }>(`/api/availability/batch?ids=${encodeURIComponent(titleIds.join(","))}`),
    // A guest has no servers: nothing plays, and the page doesn't spend a request on it while it loads.
    enabled: titleIds.length > 0 && profile !== null,
    initialData: profile === null ? { playable: {} } : undefined,
    staleTime: 60_000,
    select: (r) => r.playable,
  });
}
