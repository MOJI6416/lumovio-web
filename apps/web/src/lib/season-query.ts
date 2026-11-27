import type { SeasonDetails } from "@lumovio/contracts";
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** A season whose episodes the catalog is still loading is asked again this often, this many times (a minute and a half). */
const AGAIN_MS = 3_000;
const TRIES = 30;

/**
 * A series' season as every part of the site asks it, one cache for all (the title's season browser, the player's
 * episodes and next episode, the sources' episode pick, the TV's row). While the catalog is loading its episodes
 * (`pending`), the answer is never fresh and is asked again every few seconds until they come.
 */
export const seasonQuery = (tmdbId: number, season: number | null, locale: string) =>
  queryOptions({
    queryKey: ["season", tmdbId, season, locale],
    queryFn: () => api<SeasonDetails>(`/api/catalog/tv/${tmdbId}/season/${season}`),
    staleTime: (q) => (q.state.data?.pending ? 0 : 30 * 60_000),
    refetchInterval: (q) => (q.state.data?.pending && q.state.dataUpdateCount < TRIES ? AGAIN_MS : false),
  });

/** The season's episodes are still coming: asked again, and fewer here than the season has. */
export const episodesComing = (d: SeasonDetails | undefined, expected: number | undefined, updates: number) =>
  Boolean(d?.pending) && updates < TRIES && (d?.episodes.length ?? 0) < Math.max(1, expected ?? 0);
