"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { PosterCard } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { Button } from "@/components/ui/Button";
import { GenreTile } from "./GenreTile";
import { recentSearches, useRecentSearches } from "./recent-searches";
import type { GenreTile as Tile } from "./search-model";

/**
 * A search without a query (design-system 9 "Search"), never an empty page: the recent searches (a press searches
 * again, "Clear" forgets them), what's popular now as a shelf, and the genres as picture tiles that open the catalog.
 */
export function SearchStart({ popular, tiles, onRecent }: { popular: TitleSummary[]; tiles: Tile[]; onRecent: (q: string) => void }) {
  const t = useTranslations("search");
  const tb = useTranslations("browse");
  const recent = useRecentSearches();
  return (
    <div className="mt-8 flex flex-col gap-10 md:mt-10 md:gap-12">
      {recent.length > 0 && (
        <section aria-labelledby="recent-h">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 id="recent-h" className="text-h2 text-text-1">
              {t("recent")}
            </h2>
            <Button variant="tertiary" size="sm" onClick={recentSearches.clear}>
              {t("clearRecent")}
            </Button>
          </div>
          {/* One line that scrolls on a phone, wrapping lines on a wider screen. */}
          <ul className="scroll-row -mx-(--gutter) flex gap-2 overflow-x-auto px-(--gutter) *:shrink-0 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {recent.map((r) => (
              <li key={r} className="min-w-0 max-w-full">
                {/* Searches again for this query. */}
                <Button variant="secondary" size="sm" icon={History} onClick={() => onRecent(r)} className="max-w-80">
                  <span className="truncate">{r}</span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {popular.length > 0 && (
        <div className="-mx-(--gutter)">
          <Row id="search-popular" title={t("popularNow")}>
            {popular.map((x) => (
              <PosterCard key={x.id} title={x} />
            ))}
          </Row>
        </div>
      )}
      {tiles.length > 0 && (
        <section aria-labelledby="genres-h">
          <h2 id="genres-h" className="mb-3 text-h2 text-text-1 md:mb-4">
            {tb("genres")}
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-6 xl:gap-4">
            {tiles.map((g) => (
              <GenreTile key={g.id} tile={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
