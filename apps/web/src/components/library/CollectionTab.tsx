"use client";

import type { TitleLibraryState } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Heart, ListFilterPlus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";
import { PosterCard } from "@/components/media/PosterCard";
import { TitleGrid } from "@/components/media/Row";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryState } from "@/components/ui/QueryState";
import { usePlayable } from "@/hooks/useAvailability";
import { libraryKey } from "@/hooks/useLibraryState";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatRuntime } from "@/lib/format";
import { CollectionToolbar } from "./CollectionToolbar";
import { sortItems, useTitleSorts } from "./sorting";
import { readFilters, readSort, useUrlState } from "./url-state";
import { GridSkeleton } from "./GridSkeleton";
import { systemListQuery } from "./whole-list";
import { editListId, libraryRules } from "./rules-url";
import type { RulesEdit } from "./SaveRulesDialog";

// Loaded when used (bundle budget): "Save as list" and "Edit conditions" of a smart list (package F).
const SaveRulesDialog = lazy(() => import("./SaveRulesDialog").then((m) => ({ default: m.SaveRulesDialog })));
const EditRulesBar = lazy(() => import("./EditRulesBar").then((m) => ({ default: m.EditRulesBar })));

/** Watched state for every id, 100 per request; also fills the per-card cache. */
function useWatchedIds(ids: string[], enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["library-watched", ids.join(",")],
    enabled: enabled && ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const watched = new Set<string>();
      for (let i = 0; i < ids.length; i += 100) {
        const { states } = await api<{ states: TitleLibraryState[] }>(`/api/library/state?ids=${encodeURIComponent(ids.slice(i, i + 100).join(","))}`);
        for (const st of states) {
          qc.setQueryData(libraryKey(st.titleId), st);
          if (st.watchedCount > 0 || (st.progress?.completed && st.titleId.startsWith("movie:"))) watched.add(st.titleId);
        }
      }
      return watched;
    },
  });
}

const SORTS = ["added", "title", "year", "rating"] as const;
type Sort = (typeof SORTS)[number];


/**
 * "Watchlist" and "Favourites" (S09): the compact filter row with the sort (LIB-04, LIB-10, LIB-17) over the grid of
 * Ф3 poster cards. Filters work on the whole list (every page of it, LIB-24), at once; their state is in the address and
 * survives a tab change.
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
        loading={<GridSkeleton />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon={Icon}
            title={kind === "watchlist" ? t("emptyWatchlist") : t("emptyFavorites")}
            text={kind === "watchlist" ? t("emptyWatchlistHint") : t("emptyFavoritesHint")}
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
              runtime
              status
              servers
              unwatched
              sort={{ value: sort, onChange: (v) => set({ sort: v === "added" ? null : v }), options: sorts({ value: "added" }) }}
              shown={items.length}
              total={all.length}
              action={
                // While a smart list's conditions are edited, the banner above saves them back instead.
                !editing && (
                  <Button variant="tertiary" size="sm" icon={ListFilterPlus} onClick={() => setSaving(null)}>
                    {t("saveAsList")}
                  </Button>
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
              <TitleGrid>
                {items.map((i) => (
                  <PosterCard
                    key={i.title.id}
                    title={i.title}
                    // The card's own line (year · rating · type); with a length limit on, the length it was kept by.
                    subtitle={filters.max && i.runtime ? [i.title.year, minutes(i.runtime)].filter(Boolean).join(" · ") : undefined}
                  />
                ))}
              </TitleGrid>
            )}
          </div>
        )}
      </QueryState>
    </>
  );
}
