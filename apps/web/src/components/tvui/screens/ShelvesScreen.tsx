"use client";

import type { FeaturedTitle, Genre } from "@lumovio/contracts";
import { type FocusEvent, type ReactNode, useCallback, useMemo, useState } from "react";
import { cn } from "@/components/ui/cn";
import { titleHref } from "@/lib/slug";
import { CardMoreLayer, type CardTarget, HoldHint, useHidden, useStable } from "../media/hold";
import { backdropOf, Spotlight, TvBackdrop } from "../media/Spotlight";
import { TvShelf } from "../media/TvShelf";
import type { TvItem, TvShelfData } from "../media/types";
import type { ScreenLevel } from "../nav/TvNav";

/*
 * A screen of shelves — the home and the Movies, Series and Anime sections: the spotlight at the top (the
 * featured title with its actions first, then whatever card has the focus) and the
 * shelves under it, the focused shelf always at the same height under the spotlight (`data-scroll="pin"`), so the
 * remote never makes a shelf "fly past". ↑ from the first shelf goes to the featured title's actions. A card of
 * Continue watching has "More" (held OK, ../media/hold): the spotlight says so, and a removed card leaves the shelf at once.
 */

export function ShelvesScreen({
  level,
  heading,
  hero,
  heroActions,
  shelves: all,
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
  const { hidden, hide } = useHidden();
  // Removed cards leave their shelf at once; a shelf left empty goes (never an empty shelf). Unchanged
  // shelves keep their identity, so their memoised cards don't render again.
  const shelves = useMemo(
    () =>
      hidden.size
        ? all
            .map((s) =>
              s.removable && s.items.some((i) => hidden.has(i.title.id))
                ? { ...s, items: s.items.filter((i) => !hidden.has(i.title.id)) }
                : s,
            )
            .filter((s) => s.items.length > 0)
        : all,
    [all, hidden],
  );
  const first: TvItem | null = hero ? { title: hero } : (shelves[0]?.items[0] ?? null);
  const [spot, setSpot] = useState<{ item: TvItem | null; more: boolean }>({ item: first, more: false });
  const [more, setMore] = useState<CardTarget | null>(null);

  // The spotlight follows the focus: a card says which shelf and place it is (data-index in its zone).
  const onFocus = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-zone="hero"]')) return setSpot({ item: hero ? { title: hero } : null, more: false });
      const zone = el.closest<HTMLElement>("[data-zone^='shelf:']")?.dataset.zone;
      const index = el.dataset.index;
      if (!zone || index === undefined) return;
      const shelf = shelves[Number(zone.slice(6))];
      const item = shelf?.items[Number(index)];
      if (item) setSpot({ item, more: Boolean(shelf.removable) });
    },
    [hero, shelves],
  );

  // "More" of a Continue watching card: removed here at once; the home's data follows from the server (router.refresh),
  // so Back to this screen later doesn't bring the card back from the router's cache.
  const onMore = useStable((index: number) => {
    const item = shelves.find((s) => s.removable)?.items[index];
    if (!item) return;
    const x = item.title;
    setMore({ kind: "continue", title: x, details: titleHref(x.kind, x.tmdbId, x.title), refresh: true });
  });

  const spotItem = spot.item;
  return (
    <div data-tv-screen={level} onFocus={onFocus} className="stage relative h-full overflow-hidden bg-stage">
      <h1 className="sr-only">{heading}</h1>
      <TvBackdrop src={backdropOf(spotItem)} />
      <div className="absolute inset-x-0 top-0 flex h-(--tv-spot-h) items-end ps-(--tv-pad) pe-(--gutter) pb-8">
        <Spotlight item={spotItem} genres={genres}>
          <div className="grid">
            {/* Always there, so ↑ from the first shelf has somewhere to go; seen while the featured title is in the
                spotlight — the moment one of them gets the focus. */}
            {hero && heroActions && (
              <div
                className={cn(
                  "col-start-1 row-start-1 transition-opacity duration-base",
                  spotItem?.title.id !== hero.id && "pointer-events-none opacity-0",
                )}
              >
                {heroActions}
              </div>
            )}
            {spot.more && <HoldHint className="col-start-1 row-start-1 flex items-center gap-3 self-center text-body-l text-text-2" />}
          </div>
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
            {/* ↑ from the first shelf names the hero: found by geometry, it was missed while the shelves slid back
                under it (a second ↑ pressed during the slide did nothing). */}
            {shelves.map((s, i) => (
              <TvShelf
                key={s.key}
                shelf={s}
                zone={`shelf:${i}`}
                initial={!hero && i === 0}
                onMore={s.removable ? onMore : undefined}
                up={hero && heroActions && i === 0 ? "hero" : undefined}
              />
            ))}
          </div>
        </div>
      )}
      {more && (
        <CardMoreLayer target={more} hide={() => hide(more.title.id)} onClose={() => setMore(null)} />
      )}
    </div>
  );
}
