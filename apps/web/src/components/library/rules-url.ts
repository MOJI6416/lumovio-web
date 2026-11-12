import type { LibraryRulesList, ListRules } from "@lumovio/contracts";
import { catalogHref } from "@/lib/discover-rules";
import type { LibraryFilters } from "./url-state";

export type LibraryRules = Extract<ListRules, { from: "library" }>;

/** A library smart list's conditions from a collection tab's filters: its lists, type, length, status, personal ones. */
export function libraryRules(lists: LibraryRulesList[], f: LibraryFilters): LibraryRules {
  return { from: "library", lists, show: f.show, max: f.max, status: f.status, onServers: f.onServers, unwatched: f.unwatched };
}

/** The collection tab with a library smart list's conditions in its filters ("Edit conditions" with `editList`). */
export function libraryHref(r: LibraryRules, editList?: string): string {
  const sp = new URLSearchParams({ tab: r.lists[0] ?? "watchlist" });
  if (r.show) sp.set("show", r.show);
  if (r.max) sp.set("max", String(r.max));
  if (r.status) sp.set("status", r.status);
  if (r.onServers) sp.set("avail", "1");
  if (r.unwatched) sp.set("unwatched", "1");
  if (editList) sp.set("editList", editList);
  return `/library?${sp}`;
}

/** Where a smart list's conditions are set: the catalog grid or the library tab; with `editList`, to save them back. */
export function rulesHref(r: ListRules, editList?: string): string {
  return r.from === "catalog" ? catalogHref(r.query, editList) : libraryHref(r, editList);
}

/** The list being edited (`?editList=` from "Edit conditions"), if the address names one. */
export function editListId(params: { get: (k: string) => string | null }): string | null {
  const id = params.get("editList");
  return id && /^[0-9a-f-]{36}$/.test(id) ? id : null;
}
