"use client";

import { createContext, useContext } from "react";

/**
 * A shelf's cards that left it at once ("Not interested" from a card's menu): the card hides itself, and "Undo"
 * brings it back to the same place. Outside a shelf (grids, search) a card stays where it is.
 */
export interface Shelf {
  gone: ReadonlySet<string>;
  /** Takes a title's card off the shelf; returns how to put it back. */
  dismiss: (titleId: string) => () => void;
}

export const ShelfContext = createContext<Shelf | null>(null);

export const useShelf = () => useContext(ShelfContext);

/** Whether this title's card has left the shelf it is on. */
export function useDismissed(titleId: string) {
  return useContext(ShelfContext)?.gone.has(titleId) ?? false;
}
