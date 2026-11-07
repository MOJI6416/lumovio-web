"use client";

import type { TitleLibraryState } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { libraryKey } from "@/hooks/useLibraryState";
import { api } from "@/lib/api";

/** Watched state for every id, 100 per request ("Not watched yet" of a collection); also fills the per-card cache. */
export function useWatchedIds(ids: string[], enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["library-watched", ids.join(",")],
    enabled: enabled && ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const watched = new Set<string>();
      for (let i = 0; i < ids.length; i += 100) {
        const { states } = await api<{ states: TitleLibraryState[] }>(`/api/library/state?ids=${encodeURIComponent(ids.slice(i, i + 100).join(","))}`);
        for (const st of states) {
          qc.setQueryData(libraryKey(st.titleId), st);
          if (st.watchedCount > 0 || (st.progress?.completed && st.titleId.startsWith("movie:"))) watched.add(st.titleId);
        }
      }
      return watched;
    },
  });
}
