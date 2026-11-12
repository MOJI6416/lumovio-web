import type { ListDetails, TitleSummary } from "@lumovio/contracts";
import { api } from "@/lib/api";

/** A list's pages as one list of titles: a title seen on two pages (the list changed between them) once. */
export const mergedItems = (pages: ListDetails[]) => [...new Map(pages.flatMap((p) => p.items).map((i) => [i.title.id, i])).values()];

/**
 * A list with all its titles, page after page: "Watchlist" and "Favourites" filter and sort the whole of it.
 * The library's start and its tabs read the same query (`systemListQuery`), so they share this function.
 */
export async function wholeList(path: string): Promise<ListDetails> {
  const pages = [await api<ListDetails>(path)];
  for (let next = pages[0]!.nextOffset; next; next = pages.at(-1)!.nextOffset) {
    pages.push(await api<ListDetails>(`${path}?offset=${next}`));
  }
  return { ...pages[0]!, items: mergedItems(pages), nextOffset: null };
}

/** "Watchlist" or "Favourites" with all its titles. */
export const systemListQuery = (kind: "watchlist" | "favorites") => ({
  queryKey: ["library", kind],
  queryFn: () => wholeList(`/api/library/${kind}`),
});

/** What is on the profile's servers, newest first: the library's shelf and its "On my servers" page. */
export const onServersQuery = {
  queryKey: ["on-servers"],
  queryFn: () => api<{ items: TitleSummary[] }>("/api/library/on-servers"),
};
