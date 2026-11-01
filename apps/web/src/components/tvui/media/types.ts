import type { FeaturedTitle, TitleSummary } from "@lumovio/contracts";

/** A card of a TV shelf and what the spotlight says about it. */
export interface TvItem {
  title: TitleSummary | FeaturedTitle;
  /** One line over the description: why it's here ("Because you liked …"), or where you stopped ("Season 1, episode 4 · 22 min left"). */
  note?: string | null;
  /** Where OK goes (the player for Continue watching); the title's page by default. */
  href?: string;
  /** The card's accessible name, when it says more than the title. */
  label?: string;
  progress?: number;
}

export interface TvShelfData {
  key: string;
  title: string;
  shape: "poster" | "wide" | "top10";
  items: TvItem[];
  /** The shelf's whole list (a grid with its filters): a last card "See all". */
  href?: string | null;
  /** Its cards can be removed from it by holding OK (Continue watching, ./CardMore). */
  removable?: boolean;
}

/** Overviews as long as the spotlight shows them (three lines): the rest only weighs the page. */
export const trimOverview = <T extends TitleSummary>(t: T): T =>
  t.overview && t.overview.length > 320
    ? { ...t, overview: `${t.overview.slice(0, 317).replace(/\s+\S*$/, "")}…` }
    : t;
