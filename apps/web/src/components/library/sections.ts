/** The library's collections, each a page of its own under the library's screen (`/library?tab=…`, S09). */
export const LIBRARY_SECTIONS = ["servers", "watchlist", "favorites", "history", "ratings", "lists"] as const;
export type LibrarySection = (typeof LIBRARY_SECTIONS)[number];

/** The collection an address opens; anything else (none, the old "overview") is the library's screen. */
export function librarySection(tab: string | string[] | undefined): LibrarySection | null {
  return LIBRARY_SECTIONS.find((s) => s === tab) ?? null;
}
