import type { ReactNode } from "react";
import { CARD_GAP_X } from "@/components/media/card-sizes";
import { cn } from "@/components/ui/cn";

/**
 * A collection's grid runs edge to edge, as the catalog's (design-system 5.4, owner 2026-11-06): as many columns as fit
 * cards of at least 144 px (md) or 168 px (xl and 2xl), sharing what is left; three on a phone. `auto-fill`, so a short
 * collection keeps column-sized cards. Posters and lists (a ListCard is a poster card's width) alike.
 */
export const COLLECTION_GRID = cn(
  "grid grid-cols-3 gap-y-6 md:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]",
  CARD_GAP_X,
);

/** Titles or lists on the collection grid. Works in server components. */
export function ListGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(COLLECTION_GRID, className)}>{children}</div>;
}
