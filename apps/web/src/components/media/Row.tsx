"use client";

import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Children, type ReactNode, type RefObject, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useHydrated } from "@/components/title/hydrated";
import { IconButton } from "@/components/ui/IconButton";
import { Link } from "@/components/ui/Link";
import { discoveryPage, observeShelf } from "@/lib/discovery-metrics";
import { CARD_GAP_X, type CardShape, GRID_COLS, SHELF_COLS } from "./card-sizes";
import { type Shelf, ShelfContext } from "./shelf-context";
import { ShelfInfo } from "./ShelfInfo";
import { drawInTurn, restoredScrollY } from "./shelf-turns";

export type RowKind = CardShape;

/**
 * One focus stop per card in a shelf (HOME-15): Tab enters the shelf on its current card (its link, then its "More"),
 * ←/→ (and Home/End) move between cards, Tab leaves the shelf. The TV mode keeps its own arrow navigation.
 */
function useRovingCards(ref: RefObject<HTMLElement | null>, shown: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!shown || !el || document.documentElement.dataset.tv === "1") return;
    let active: Element | null = null;
    const cards = () => [...el.children];
    const apply = () => {
      const all = cards();
      if (!active || !el.contains(active)) active = all[0] ?? null;
      for (const card of all) {
        const value = card === active ? "0" : "-1";
        for (const f of card.querySelectorAll<HTMLElement>("a[href], button")) if (f.getAttribute("tabindex") !== value) f.setAttribute("tabindex", value);
      }
    };
    apply();
    // Cards come and go (Undo, "Not interested") and a card's "More" turns into the full menu: keep one stop.
    const mo = new MutationObserver(apply);
    mo.observe(el, { childList: true, subtree: true });
    const onFocusIn = (e: FocusEvent) => {
      const card = cards().find((c) => c.contains(e.target as Node));
      if (card && card !== active) {
        active = card;
        apply();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
      const all = cards();
      const i = all.findIndex((c) => c.contains(document.activeElement));
      if (i < 0) return;
      const forward = (e.key === "ArrowRight") !== (getComputedStyle(el).direction === "rtl");
      const j = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : Math.min(all.length - 1, Math.max(0, i + (forward ? 1 : -1)));
      e.preventDefault();
      if (j === i) return;
      active = all[j]!;
      apply();
      all[j]!.querySelector<HTMLElement>("a[href]")?.focus({ preventScroll: true });
      // Reduced motion jumps instead of gliding (6.3).
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      all[j]!.scrollIntoView({ block: "nearest", inline: "nearest", behavior: smooth ? "smooth" : "auto" });
    };
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("keydown", onKeyDown);
    return () => {
      mo.disconnect();
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, shown]);
}

/**
 * A shelf (design-system 7.13): the h2, the "i" with what it is and how it was picked (instead of grey notes, HOME-07),
 * and "All" at the end of the heading row whenever there is a whole page of it — always visible. Cards of one width
 * (5.4) in a row that scrolls with a swipe and snaps; on a phone the next card peeks in; on a tablet and desktop arrows
 * appear at the edges on hover, and the edges fade where there is more. A shelf with fewer than `min` cards is not shown:
 * the home page and the catalog pass 3 (7.13, HOME-05), "Continue watching" 1; a profile's own collections keep any
 * count until their screens decide (Ф6). No filter chips inside a shelf: a filter is the "All" page (7.13).
 * A card that leaves the shelf ("Not interested") does so at once; "Undo" puts it back (./shelf-context).
 */
export function Row({
  title,
  heading,
  note,
  rules,
  info,
  actions,
  href,
  children,
  id,
  kind = "poster",
  min = 1,
}: {
  title: string;
  /** What the h2 shows when it's more than `title`'s text: a name in another language marked with `lang` (8.11). */
  heading?: ReactNode;
  /** What the shelf is, in plain words (in the "i"). */
  note?: string;
  /** How it was picked, its source (in the "i"). */
  rules?: string;
  /** More for the "i": a link to adjust the shelf. */
  info?: ReactNode;
  /** Controls at the end of the heading row (the starter's "Not now"); never filters. */
  actions?: ReactNode;
  href?: string | null;
  children: ReactNode;
  id?: string;
  kind?: RowKind;
  min?: number;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  // Cards drawn at once while hydrating (the server's HTML has them all); after a client-side navigation, in turns
  // (./shelf-turns): the shelves on or near the first screen before the page paints, the rest right after.
  const hydrated = useHydrated();
  const [drawn, setDrawn] = useState(!hydrated);
  useLayoutEffect(() => {
    const el = section.current;
    if (drawn || !el) return;
    // In the site's TV mode the remote's arrows step from shelf to shelf: every shelf is drawn at once there.
    // Near the screen as it will be: Back and Forward bring the place the page was left at (restoredScrollY); a new page
    // opens at its top, whatever the scroll of the page before still is now.
    const back = restoredScrollY();
    const top = back === null ? el.getBoundingClientRect().top : el.getBoundingClientRect().top + window.scrollY - back;
    if (document.documentElement.dataset.tv === "1" || (top < innerHeight * 1.5 && (back === null || top > -innerHeight))) {
      setDrawn(true);
      return;
    }
    // A transition: a tap that leaves the page meanwhile renders first, and the old page's shelves are never drawn.
    return drawInTurn(el, () => startTransition(() => setDrawn(true)));
  }, [drawn]);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const shelf = useMemo<Shelf>(
    () => ({
      gone,
      dismiss: (titleId) => {
        setGone((s) => new Set(s).add(titleId));
        return () =>
          setGone((s) => {
            const next = new Set(s);
            next.delete(titleId);
            return next;
          });
      },
    }),
    [gone],
  );
  const shown = Children.toArray(children).length >= min;

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const x = Math.abs(el.scrollLeft); // RTL scrollLeft is negative
    const start = x < 8;
    const end = x > max - 8;
    // Scroll events come every frame; the shelf re-renders only when an edge changes.
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the scroller appears with `shown`
  useEffect(() => {
    // No measuring here: reading scrollWidth on mount forced the layout of every shelf, the ones content-visibility
    // skips too (~250 ms of a phone's catalog render). ResizeObserver reports each scroller once it is laid out.
    const el = ref.current;
    el?.addEventListener("scroll", update, { passive: true });
    const ro = el ? new ResizeObserver(update) : null;
    if (el) ro?.observe(el);
    return () => {
      el?.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [update, shown, drawn]);

  // Anonymous discovery counters (C5): which cards of this shelf were seen and opened.
  useEffect(() => {
    const el = ref.current;
    if (!shown || !el || !id) return;
    // The page's C5 comparison arm, when the API built it in one (`data-discovery-variant` on the page's shelves).
    const variant = el.closest<HTMLElement>("[data-discovery-variant]")?.dataset.discoveryVariant;
    return observeShelf(el, discoveryPage(window.location.pathname, window.location.search, variant), id);
  }, [id, shown]);
  useRovingCards(ref, shown);

  if (!shown) return null;

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    // Reduced motion jumps instead of gliding (6.3, audit X-26).
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.85, behavior: smooth ? "smooth" : "auto" });
  };

  const headingId = id ? `${id}-heading` : undefined;
  // The edge with more cards fades over the page's gutter (7.13); the other edge stays sharp.
  const side = (more: boolean) => (more ? "transparent" : "black");
  const mask = `linear-gradient(to right, ${side(!edges.start)} 0, black var(--gutter), black calc(100% - var(--gutter)), ${side(!edges.end)} 100%)`;
  // Arrows over the artwork (pb-16 lifts them from the card's centre to the artwork's), with a mouse, on hover.
  // A poster shelf has no captions under its cards since the 2026-11 redesign (PosterCard): no lift there.
  const arrow = `absolute inset-y-0 z-10 flex items-center ${kind === "poster" ? "" : "pb-16"} opacity-0 transition-opacity duration-base ease-base group-hover/row:opacity-100 group-focus-within/row:opacity-100 max-md:hidden pointer-coarse:hidden in-data-[tv=1]:hidden`;

  return (
    // `.shelf`: drawn only when it comes near the screen, holding the height of its kind of cards until then (globals.css);
    // a shelf waiting for its turn holds that height too.
    <section ref={section} className={clsx("shelf group/row relative", !drawn && "min-h-(--shelf-h)")} data-shelf={kind} aria-labelledby={headingId}>
      <div className="page-x mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 md:mb-4">
        <h2 id={headingId} className="text-h2 text-text-1">
          {heading ?? title}
        </h2>
        {(note || rules || info) && <ShelfInfo title={title} note={note} rules={rules} link={info} />}
        {/* A shelf's own actions take a line of their own on a phone, from the page's margin (the starter shelf's three). */}
        <div className={clsx("ms-auto flex items-center gap-x-4 gap-y-1", actions && "max-sm:ms-0 max-sm:basis-full")}>
          {actions}
          {href && (
            // At least 44 wide on a phone too, whatever the word's length (5.6; "Усі").
            <Link variant="action" arrow href={href} aria-label={`${t("common.seeAll")}: ${title}`} className="justify-end max-sm:min-w-11">
              {t("common.seeAll")}
            </Link>
          )}
        </div>
      </div>
      <div className="relative">
        <ShelfContext.Provider value={shelf}>
          <div
            ref={ref}
            style={{ maskImage: mask, WebkitMaskImage: mask }}
            className={clsx(
              // Vertical room so a card's rise on hover and its focus ring aren't clipped by the scroller.
              "scroll-row page-x -my-3 grid grid-flow-col overflow-x-auto overflow-y-hidden scroll-px-(--gutter) py-3 *:snap-start",
              SHELF_COLS[kind],
              CARD_GAP_X,
            )}
          >
            {drawn && children}
          </div>
        </ShelfContext.Provider>
        {!edges.start && (
          <div className={clsx(arrow, "start-2")}>
            <IconButton icon={ChevronLeft} variant="stage" size="lg" tabIndex={-1} label={t("rows.scrollLeft")} onClick={() => scroll(-1)} />
          </div>
        )}
        {!edges.end && (
          <div className={clsx(arrow, "end-2")}>
            <IconButton icon={ChevronRight} variant="stage" size="lg" tabIndex={-1} label={t("rows.scrollRight")} onClick={() => scroll(1)} />
          </div>
        )}
      </div>
    </section>
  );
}

/** A grid of poster cards (Collection pages: catalog, search, library, lists): the shelf's card width, as many as fit (5.4). */
export function TitleGrid({ children }: { children: ReactNode }) {
  return <div className={clsx("grid gap-y-6", GRID_COLS.poster, CARD_GAP_X)}>{children}</div>;
}
