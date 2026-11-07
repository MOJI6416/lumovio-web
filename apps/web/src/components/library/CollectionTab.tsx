"use client";

import { useQuery } from "@tanstack/react-query";
import { Bookmark, Heart, ListFilterPlus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { lazy, memo, Suspense, useState } from "react";
import { PosterCard } from "@/components/media/PosterCard";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { QueryState } from "@/components/ui/QueryState";
import { usePlayable } from "@/hooks/useAvailability";
import { Link } from "@/i18n/navigation";
import { formatRuntime } from "@/lib/format";
import { CollectionToolbar } from "./CollectionToolbar";
import { sortItems, useTitleSorts } from "./sorting";
import { readFilters, readSort, useUrlState } from "./url-state";
import { GridSkeleton } from "./GridSkeleton";
import { ListGrid } from "./ListGrid";
import { ShowMore, useShowMore } from "./show-more";
import { useWatchedIds } from "./watched";
import { systemListQuery } from "./whole-list";
import { editListId, libraryRules } from "./rules-url";
import type { RulesEdit } from "./SaveRulesDialog";

// Loaded when used (bundle budget): "Save as list" and "Edit conditions" of a smart list (package F).
const SaveRulesDialog = lazy(() => import("./SaveRulesDialog").then((m) => ({ default: m.SaveRulesDialog })));
const EditRulesBar = lazy(() => import("./EditRulesBar").then((m) => ({ default: m.EditRulesBar })));

/** A card that doesn't draw again when "Show more" adds the next ones (./show-more). */
const Card = memo(PosterCard);

const SORTS = ["added", "title", "year", "rating"] as const;
type Sort = (typeof SORTS)[number];

/**
 * "Watchlist" and "Favourites" (S09), each a page of its own: the row of filter pills with the sort (8.4, 7.4) over the
 * collection's grid edge to edge (5.4), 60 at a time with "Show more" (as a list, LIB-14). Filters work on the whole
 * list (every page of it, LIB-24), at once; their state is in the address.
 */
export function CollectionTab({ kind, locale }: { kind: "watchlist" | "favorites"; locale: string }) {
  const t = useTranslations("library");
  const tr = useTranslations();
  const { me } = useSession();
  const { params, set } = useUrlState();
  const sorts = useTitleSorts();
  const q = useQuery(systemListQuery(kind));
  const filters = readFilters(params);
  // "Save as list" (null) or a smart list's "Edit conditions" (its list) open the dialog; false — closed (package F).
  const [saving, setSaving] = useState<RulesEdit | null | false>(false);
  const editing = editListId(params);
  const sort = readSort<Sort>(params, SORTS, "added");

  const all = q.data?.items ?? [];
  const ids = all.map((i) => i.title.id);
  const playable = usePlayable(filters.onServers ? ids : []);
  const watched = useWatchedIds(ids, filters.unwatched);
  const kids = Boolean(me?.activeProfile?.isKids);

  // The type chips only where the collection holds both films and series.
  const mixed = all.some((i) => i.title.kind === "movie") && all.some((i) => i.title.kind === "tv");
  const pending = (filters.onServers && playable.isLoading) || (filters.unwatched && watched.isLoading);
  const items = sortItems(
    all.filter(
      (i) =>
        (!filters.show || i.title.kind === filters.show) &&
        // A length limit only keeps titles whose length is known.
        (!filters.max || (i.runtime !== null && i.runtime <= filters.max)) &&
        // A status keeps the series the catalog index knows to be of it (as the catalog's filter does).
        (!filters.status || i.status === filters.status) &&
        (!filters.onServers || playable.data?.[i.title.id] === "server") &&
        (!filters.unwatched || !watched.data?.has(i.title.id)),
    ),
    sort,
    locale,
  );
  // Drawn 60 at a time (a heavy Watchlist was 7 000 nodes and over a second of long tasks at once); filters and the
  // sort still work on the whole list.
  const { limit, more } = useShowMore(`${kind}?${params.toString()}`);
  const minutes = (m: number) => formatRuntime(m, (k, v) => tr(k as "common.minutes", v)) ?? "";
  const Icon = kind === "watchlist" ? Bookmark : Heart;

  return (
    <>
      {editing && (
        <Suspense>
          <EditRulesBar listId={editing} onSave={setSaving} className="mb-6" />
        </Suspense>
      )}
      {saving !== false && (
        <Suspense>
          <SaveRulesDialog
            open
            onOpenChange={(o) => !o && setSaving(false)}
            target={{ from: "library", rules: libraryRules([kind], filters), tab: kind }}
            edit={saving}
          />
        </Suspense>
      )}
      <QueryState
        query={q}
        loading={<GridSkeleton toolbar />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon={Icon}
            title={kind === "watchlist" ? t("emptyWatchlist") : t("emptyFavorites")}
            // How a title gets here, for a screen reader: the heading and "Find titles" say enough (1.2).
            text={<span className="sr-only">{kind === "watchlist" ? t("emptyWatchlistHint") : t("emptyFavoritesHint")}</span>}
            action={
              <Link href="/search" className={buttonClass("primary")}>
                <Search aria-hidden />
                {t("findTitles")}
              </Link>
            }
            secondaryAction={
              kind === "watchlist" &&
              !kids && (
                <Link href="/import" className={buttonClass("tertiary")}>
                  {t("startImportCta")}
                </Link>
              )
            }
          />
        }
        error={{ title: t("loadError") }}
      >
        {() => (
          <div>
            <CollectionToolbar
              filters={filters}
              set={set}
              types={mixed}
              runtime
              status
              servers
              unwatched
              sort={{ value: sort, onChange: (v) => set({ sort: v === "added" ? null : v }), options: sorts({ value: "added" }) }}
              shown={items.length}
              total={all.length}
              action={
                // While a smart list's conditions are edited, the banner above saves them back instead.
                // On a phone the line under the filters has room for its icon only (named for a screen reader).
                !editing && (
                  <>
                    <IconButton icon={ListFilterPlus} label={t("saveAsList")} onClick={() => setSaving(null)} className="sm:hidden" />
                    <Button variant="tertiary" size="sm" icon={ListFilterPlus} onClick={() => setSaving(null)} className="max-sm:hidden">
                      {t("saveAsList")}
                    </Button>
                  </>
                )
              }
            />
            {pending ? (
              <GridSkeleton count={Math.min(12, all.length)} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Icon}
                title={t("filterEmpty")}
                action={
                  <Button variant="secondary" onClick={() => set({ show: null, max: null, status: null, avail: null, unwatched: null })}>
                    {tr("common.resetFilters")}
                  </Button>
                }
              />
            ) : (
              <>
                <ListGrid>
                  {items.slice(0, limit).map((i) => (
                    <Card
                      key={i.title.id}
                      title={i.title}
                      // The card's own line (year · rating · type); with a length limit on, the length it was kept by.
                      subtitle={filters.max && i.runtime ? [i.title.year, minutes(i.runtime)].filter(Boolean).join(" · ") : undefined}
                    />
                  ))}
                </ListGrid>
                <ShowMore shown={Math.min(limit, items.length)} total={items.length} onMore={more} />
              </>
            )}
          </div>
        )}
      </QueryState>
    </>
  );
}
