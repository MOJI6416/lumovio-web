import { clsx } from "clsx";
import { Popcorn } from "lucide-react";

/**
 * Logos of the services we credit or link to (trademarks of their owners, used only to name the
 * source). Files live in /public/brands: Wikimedia Commons text logos, TMDB's official attribution
 * logo, TVmaze's site logo. Rotten Tomatoes' Popcornmeter gets a generic popcorn icon and Trakt its
 * name only: no logo file of theirs is in the repository.
 */
export type Brand =
  | "imdb"
  | "rotten_tomatoes"
  | "rotten_tomatoes_audience"
  | "metacritic"
  | "anilist"
  | "tvmaze"
  | "tmdb"
  | "letterboxd"
  | "kinopoisk"
  | "myanimelist"
  | "trakt"
  | "wikidata";

export const BRAND_NAMES: Record<Brand, string> = {
  imdb: "IMDb",
  rotten_tomatoes: "Rotten Tomatoes",
  rotten_tomatoes_audience: "Popcornmeter",
  metacritic: "Metacritic",
  anilist: "AniList",
  tvmaze: "TVmaze",
  tmdb: "TMDB",
  letterboxd: "Letterboxd",
  kinopoisk: "Kinopoisk",
  myanimelist: "MyAnimeList",
  trakt: "Trakt",
  wikidata: "Wikidata",
};

const FILES: Partial<Record<Brand, { src: string; cls: string; wordmark: boolean }>> = {
  imdb: { src: "/brands/imdb.svg", cls: "h-[1.05em]", wordmark: true },
  rotten_tomatoes: { src: "/brands/rt-fresh.svg", cls: "h-[1.15em]", wordmark: false },
  metacritic: { src: "/brands/metacritic.svg", cls: "h-[1.15em]", wordmark: false },
  anilist: { src: "/brands/anilist.svg", cls: "h-[1.15em] rounded-xs", wordmark: false },
  tvmaze: { src: "/brands/tvmaze.png", cls: "h-[1.1em]", wordmark: true },
  tmdb: { src: "/brands/tmdb-short.svg", cls: "h-[0.7em]", wordmark: true },
  letterboxd: { src: "/brands/letterboxd.svg", cls: "h-[0.85em]", wordmark: true },
  kinopoisk: { src: "/brands/kinopoisk.svg", cls: "h-[0.8em]", wordmark: true },
  myanimelist: { src: "/brands/myanimelist.svg", cls: "h-[1.15em] rounded-xs", wordmark: false },
  wikidata: { src: "/brands/wikidata.svg", cls: "h-[0.9em]", wordmark: false },
};

/** Logo sized to the surrounding text. `rotten` switches Rotten Tomatoes to its splat icon. */
export function BrandMark({ brand, rotten, className }: { brand: Brand; rotten?: boolean; className?: string }) {
  const f = FILES[brand];
  if (brand === "rotten_tomatoes_audience") return <Popcorn aria-hidden className={clsx("size-[1.1em] shrink-0", className)} />;
  if (!f) return null;
  const src = brand === "rotten_tomatoes" && rotten ? "/brands/rt-rotten.svg" : f.src;
  return <img src={src} alt={BRAND_NAMES[brand]} className={clsx("inline-block w-auto shrink-0 select-none", f.cls, className)} draggable={false} />;
}

/** Whether the logo already spells the name (wordmark) or is an icon that needs a text label. */
export const isWordmark = (brand: Brand) => FILES[brand]?.wordmark ?? false;
