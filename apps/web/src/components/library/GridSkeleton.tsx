import { clsx } from "clsx";
import { CARD_GAP_X, GRID_COLS, SHELF_COLS } from "@/components/media/card-sizes";
import { Skeleton } from "@/components/ui/Skeleton";

/*
 * The library's placeholders (7.11), in the layout that comes — built from ui/Skeleton only, so the page's first load
 * doesn't carry the cards' modules (the tabs themselves load lazily, LibraryView).
 */

function CardSkeleton({ shape }: { shape: "poster" | "landscape" | "square" }) {
  return (
    <div className="w-full">
      <Skeleton className={clsx("w-full", shape === "poster" ? "aspect-2/3" : shape === "landscape" ? "aspect-video" : "aspect-square")} />
      <Skeleton shape="xs" className="mt-2 h-4 w-4/5" />
      <Skeleton shape="xs" className="mt-1.5 h-3.5 w-3/5" />
    </div>
  );
}

/** A grid of poster cards at their own widths (5.4); `square` for lists. */
export function GridSkeleton({ count = 12, shape = "poster" }: { count?: number; shape?: "poster" | "square" }) {
  return (
    <div aria-hidden className={clsx("grid gap-y-6", GRID_COLS.poster, CARD_GAP_X)}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <CardSkeleton key={i} shape={shape} />
      ))}
    </div>
  );
}

/**
 * The rows of History and Ratings across the page's width (owner, 2026-10-25: not a 768 px column on the left of a wide
 * screen): one column on a phone and a tablet, two from xl, three from 2xl; each row a card of its own.
 */
export const ROW_GRID = "grid gap-2 xl:grid-cols-2 xl:gap-x-4 2xl:grid-cols-3";
export const ROW = "flex min-w-0 items-center gap-3 rounded-md border border-line bg-surface-1 px-3 py-2";

/** Rows of the history and the ratings: a day's heading and the grid of rows. */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="space-y-3">
      <Skeleton shape="xs" className="h-5 w-40" />
      <div className={ROW_GRID}>
        {Array.from({ length: rows }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <div key={i} className={ROW}>
            <Skeleton shape="sm" className="aspect-2/3 w-10" />
            <div className="flex-1 space-y-1.5">
              <Skeleton shape="xs" className="h-4 w-1/2" />
              <Skeleton shape="xs" className="h-3.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The overview's shelves: a landscape shelf and a poster shelf, out to the screen's edges as the shelves are. */
export function OverviewSkeleton() {
  const shelf = (kind: "landscape" | "poster", n: number) => (
    <div>
      <div className="page-x mb-3 md:mb-4">
        <Skeleton shape="xs" className="h-7 w-48" />
      </div>
      <div className={clsx("page-x grid grid-flow-col overflow-hidden", SHELF_COLS[kind], CARD_GAP_X)}>
        {Array.from({ length: n }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <CardSkeleton key={i} shape={kind} />
        ))}
      </div>
    </div>
  );
  return (
    <div aria-hidden className="-mx-(--gutter) flex flex-col gap-8 md:gap-12">
      {shelf("landscape", 5)}
      {shelf("poster", 9)}
    </div>
  );
}

/** The placeholder of a tab while its module loads. */
export function TabSkeleton({ tab }: { tab: string }) {
  if (tab === "overview") return <OverviewSkeleton />;
  if (tab === "history" || tab === "ratings") return <RowsSkeleton />;
  return <GridSkeleton shape={tab === "lists" ? "square" : "poster"} />;
}
