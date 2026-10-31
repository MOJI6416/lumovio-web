"use client";

import type { MediaKind } from "@lumovio/contracts";
import { ExternalLink } from "lucide-react";
import { BRAND_NAMES, type Brand } from "@/components/media/BrandMark";
import { useHydrated } from "./hydrated";
import { useTitleExternal } from "./ratings";

/** Cross-links to other film databases (Letterboxd, Kinopoisk, MyAnimeList…) found via Wikidata, beside TMDB's own. */
export function ExternalLinks({ kind, tmdbId, exclude, className }: { kind: MediaKind; tmdbId: number; exclude: string[]; className: string }) {
  const q = useTitleExternal(kind, tmdbId);
  const hydrated = useHydrated();
  const links = hydrated ? (q.data?.links ?? []).filter((l) => !exclude.includes(l.source)) : [];
  return (
    <>
      {links.map((l) => (
        <li key={l.url}>
          <a href={l.url} target="_blank" rel="noreferrer noopener" className={className}>
            {BRAND_NAMES[l.source as Brand] ?? l.source}
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </li>
      ))}
    </>
  );
}
