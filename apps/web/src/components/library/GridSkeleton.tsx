import { clsx } from "clsx";
import { CARD_GAP_X, SHELF_COLS } from "@/components/media/card-sizes";
import { Skeleton } from "@/components/ui/Skeleton";
import { COLLECTION_GRID } from "./ListGrid";

/*
 * The library's placeholders (7.11), in the layout that comes — built from ui/Skeleton only, so the page's first load
 * doesn't carry the cards' modules (the sections themselves load lazily, LibraryView).
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

/** The filter row over a collection's grid: a few pills and the count. */
export function ToolbarSkeleton() {
  return (
    <div aria-hidden className="mb-6 flex items-center gap-2">
      {["w-14", "w-20", "w-24", "w-32"].map((w) => (
        <Skeleton key={w} shape="full" className={clsx("h-8", w)} />
      ))}
    </div>
  );
}

/** A collection's grid (5.4, edge to edge); `square` for lists. */
export function GridSkeleton({ count = 12, shape = "poster", toolbar = false }: { count?: number; shape?: "poster" | "square"; toolbar?: boolean }) {
  return (
    <div aria-hidden>
      {toolbar && <ToolbarSkeleton />}
      <div className={COLLECTION_GRID}>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <CardSkeleton key={i} shape={shape} />
        ))}
      </div>
    </div>
  );
}

/** The library's shelves: a landscape shelf and poster shelves, out to the screen's edges as the shelves are. */
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
      {shelf("poster", 9)}
    </div>
  );
}

/** The placeholder of a section while its module loads. */
export function SectionSkeleton({ section }: { section: string | null }) {
  if (!section || section === "servers") return <OverviewSkeleton />;
  return <GridSkeleton shape={section === "lists" ? "square" : "poster"} toolbar={section !== "history"} />;
}
