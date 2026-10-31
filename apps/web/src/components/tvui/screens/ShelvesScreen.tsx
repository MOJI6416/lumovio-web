"use client";

import type { FeaturedTitle, Genre } from "@lumovio/contracts";
import { type FocusEvent, type ReactNode, useCallback, useState } from "react";
import { cn } from "@/components/ui/cn";
import { backdropOf, Spotlight, TvBackdrop } from "../media/Spotlight";
import { TvShelf } from "../media/TvShelf";
import type { TvItem, TvShelfData } from "../media/types";
import type { ScreenLevel } from "../nav/TvNav";

/*
 * A screen of shelves — the home and the Movies, Series and Anime sections (TV document §4 "Главная", design-system
 * 10.3): the spotlight at the top (the featured title with its actions first, then whatever card has the focus) and the
 * shelves under it, the focused shelf always at the same height under the spotlight (`data-scroll="pin"`), so the
 * remote never makes a shelf "fly past". ↑ from the first shelf goes to the featured title's actions.
 */

export function ShelvesScreen({
  level,
  heading,
  hero,
  heroActions,
  shelves,
  genres,
  empty,
}: {
  level: ScreenLevel;
  /** The screen's h1 (visually hidden on the home). */
  heading: string;
  hero: FeaturedTitle | null;
  /** The featured title's buttons: one zone, `data-zone="hero"`. */
  heroActions?: ReactNode;
  shelves: TvShelfData[];
  genres: Genre[];
  /** What to show when there isn't a single shelf. */
  empty?: ReactNode;
}) {
  const first: TvItem | null = hero ? { title: hero } : (shelves[0]?.items[0] ?? null);
  const [spot, setSpot] = useState<TvItem | null>(first);

  // The spotlight follows the focus: a card says which shelf and place it is (data-index in its zone).
  const onFocus = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-zone="hero"]')) return setSpot(hero ? { title: hero } : null);
      const zone = el.closest<HTMLElement>("[data-zone^='shelf:']")?.dataset.zone;
      const index = el.dataset.index;
      if (!zone || index === undefined) return;
      const shelf = shelves[Number(zone.slice(6))];
      const item = shelf?.items[Number(index)];
      if (item) setSpot(item);
    },
    [hero, shelves],
  );

  return (
    <div data-tv-screen={level} onFocus={onFocus} className="stage relative h-full overflow-hidden bg-stage">
      <h1 className="sr-only">{heading}</h1>
      <TvBackdrop src={backdropOf(spot)} />
      <div className="absolute inset-x-0 top-0 flex h-(--tv-spot-h) items-end ps-(--tv-pad) pe-(--gutter) pb-8">
        <Spotlight item={spot} genres={genres}>
          {/* Always there, so ↑ from the first shelf has somewhere to go; seen while the featured title is in the
              spotlight — the moment one of them gets the focus. */}
          {hero && heroActions && (
            <div
              className={cn(
                "transition-opacity duration-base",
                spot?.title.id !== hero.id && "pointer-events-none opacity-0",
              )}
            >
              {heroActions}
            </div>
          )}
        </Spotlight>
      </div>
      {shelves.length === 0 && empty ? (
        <div className="absolute inset-x-0 top-(--tv-spot-h) ps-(--tv-pad) pe-(--gutter)">{empty}</div>
      ) : (
        <div
          data-tv-scroller
          data-scroll="pin"
          data-pin="0"
          className="absolute inset-x-0 top-(--tv-spot-h) bottom-0 overflow-hidden pt-2"
        >
          <div data-tv-content data-zone-group className="flex flex-col gap-10">
            {shelves.map((s, i) => (
              <TvShelf key={s.key} shelf={s} zone={`shelf:${i}`} initial={!hero && i === 0} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
