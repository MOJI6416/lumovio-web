import type { ReactNode } from "react";
import { CARD_GAP_X, GRID_COLS } from "@/components/media/card-sizes";
import { cn } from "@/components/ui/cn";

/** Lists on the grid of poster widths (5.4): a ListCard is as wide as a poster card. Works in server components. */
export function ListGrid({ children }: { children: ReactNode }) {
  return <div className={cn("grid gap-y-6", GRID_COLS.poster, CARD_GAP_X)}>{children}</div>;
}
