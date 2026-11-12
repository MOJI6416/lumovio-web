/*
 * Card widths, one table for shelves and grids: a card of one type has the same width in a shelf
 * and in a grid at the same screen width — a grid picks how many columns fit instead of stretching the cards. On a
 * phone a grid has three columns (≈ the shelf's 112 px at 375–390 px), so the gutter and the 8 px gaps fit.
 * Sizes are rem, so the TV mode scales them with the rest of the interface.
 *
 * | Card               | Phone | md  | xl  | 2xl |
 * | Poster 2:3         | 112   | 144 | 168 | 184 |
 * | Landscape 16:9     | 240   | 280 | 304 | 336 |
 * | Top 10 (numeral + poster) | 64 + 112 | 80 + 144 | 92 + 168 | 100 + 184 |
 * | Person 1:1 (circle)| 96    | 112 | 128 | 136 |
 *
 * A Top 10 card's poster is a poster card's: the shelf is the same row of posters as every other, with the
 * rank beside each.
 */

export type CardShape = "poster" | "landscape" | "top10" | "person";

/** The columns of a horizontal shelf (`grid-flow-col`): one fixed width per card. */
export const SHELF_COLS: Record<CardShape, string> = {
  poster: "auto-cols-[7rem] md:auto-cols-[9rem] xl:auto-cols-[10.5rem] 2xl:auto-cols-[11.5rem]",
  landscape: "auto-cols-[15rem] md:auto-cols-[17.5rem] xl:auto-cols-[19rem] 2xl:auto-cols-[21rem]",
  top10: "auto-cols-[11rem] md:auto-cols-[14rem] xl:auto-cols-[16.25rem] 2xl:auto-cols-[17.75rem]",
  person: "auto-cols-[6rem] md:auto-cols-[7rem] xl:auto-cols-[8rem] 2xl:auto-cols-[8.5rem]",
};

/** A Top 10 card's two columns: the rank's numeral and the poster, a poster card's width. */
export const TOP10_COLS = "grid-cols-[4rem_7rem] md:grid-cols-[5rem_9rem] xl:grid-cols-[5.75rem_10.5rem] 2xl:grid-cols-[6.25rem_11.5rem]";
/** The numeral's column is as tall as the poster beside it (its width × 1.5), so the numeral stands on the poster's foot. */
export const TOP10_RANK_H = "h-42 md:h-54 xl:h-63 2xl:h-69";

/** Gaps between cards: 8 phone · 12 tablet · 16 desktop. */
export const CARD_GAP_X = "gap-x-2 md:gap-x-3 xl:gap-x-4";

/** The columns of a grid: as many cards of the shelf's width as fit (three on a phone). */
export const GRID_COLS: Record<"poster" | "person", string> = {
  poster: "grid-cols-3 md:grid-cols-[repeat(auto-fill,9rem)] xl:grid-cols-[repeat(auto-fill,10.5rem)] 2xl:grid-cols-[repeat(auto-fill,11.5rem)]",
  person: "grid-cols-3 md:grid-cols-[repeat(auto-fill,7rem)] xl:grid-cols-[repeat(auto-fill,8rem)] 2xl:grid-cols-[repeat(auto-fill,8.5rem)]",
};

/**
 * `sizes` of card images at these widths, so a card never downloads more than it shows. A phone's card is a third of
 * the width inside the gutters and the two gaps (a 390 px phone: 114 px; its shelf's card is 112) — "33vw" took a 3×
 * phone's posters a size up (w500 for a 114 px card).
 */
export const POSTER_SIZES = "(min-width: 1536px) 184px, (min-width: 1280px) 168px, (min-width: 768px) 144px, calc((100vw - 3rem) / 3)";
export const LANDSCAPE_SIZES = "(min-width: 1536px) 336px, (min-width: 1280px) 304px, (min-width: 768px) 280px, 240px";
