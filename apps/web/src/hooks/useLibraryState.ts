"use client";

import type { TitleLibraryState } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/providers/Providers";
import { api } from "@/lib/api";

/**
 * Batches library-state lookups from every card rendered in the same tick into one
 * `/api/library/state?ids=…` request (up to 100 ids), then serves each card from the cache.
 */
let pending = new Map<string, ((s: TitleLibraryState | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  const batch = pending;
  pending = new Map();
  timer = null;
  const ids = [...batch.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    api<{ states: TitleLibraryState[] }>(`/api/library/state?ids=${encodeURIComponent(chunk.join(","))}`)
      .then(({ states }) => {
        for (const id of chunk) {
          const s = states.find((x) => x.titleId === id) ?? null;
          for (const cb of batch.get(id) ?? []) cb(s);
        }
      })
      .catch(() => {
        for (const id of chunk) for (const cb of batch.get(id) ?? []) cb(null);
      });
  }
}

function load(id: string): Promise<TitleLibraryState | null> {
  return new Promise((resolve) => {
    const list = pending.get(id) ?? [];
    list.push(resolve);
    pending.set(id, list);
    if (!timer) timer = setTimeout(flush, 16);
  });
}

export function libraryKey(titleId: string) {
  return ["library-state", titleId] as const;
}

export function useLibraryState(titleId: string, enabled = true) {
  const { me } = useSession();
  return useQuery({
    queryKey: libraryKey(titleId),
    queryFn: () => load(titleId),
    enabled: enabled && Boolean(me?.activeProfile),
    staleTime: 5 * 60_000,
  });
}

export function useSetLibraryState() {
  const qc = useQueryClient();
  return (s: TitleLibraryState) => qc.setQueryData(libraryKey(s.titleId), s);
}
