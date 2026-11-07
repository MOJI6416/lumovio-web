"use client";

import type { SourceState, TitleSummary } from "@lumovio/contracts";
import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { Server } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { memo, useEffect } from "react";
import { PosterCard } from "@/components/media/PosterCard";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LoadMore } from "@/components/ui/LoadMore";
import { QueryState } from "@/components/ui/QueryState";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { CollectionToolbar } from "./CollectionToolbar";
import { GridSkeleton } from "./GridSkeleton";
import { ListGrid } from "./ListGrid";
import { SHOW_PAGE, useShowMore } from "./show-more";
import { sortItems, useTitleSorts } from "./sorting";
import { readFilters, readSort, useUrlState } from "./url-state";
import { useWatchedIds } from "./watched";

type Page = { items: TitleSummary[]; total: number; sources: SourceState[]; nextOffset: number | null };
type Pages = InfiniteData<Page, number>;

/** Titles a page of the servers' index brings (`/api/library/on-servers`, at most 100). */
const PAGE = 60;
const SORTS = ["added", "title", "year", "rating"] as const;
type Sort = (typeof SORTS)[number];

/** Everything here is on a server: the card's "On your server" badge would only repeat it. */
const plain = (t: TitleSummary): TitleSummary => (t.onServer ? { ...t, onServer: false } : t);
const Card = memo(PosterCard);

/**
 * "On my servers" (S09; the owner's decision of 2026-11-07, design-system 9 "Library"): everything already on the
 * profile's own servers that plays in one press — films, series, anime — as Apple TV's library and Plex's do it: the
 * collection's grid, newest copy first ("Added 22 Oct" under each), the catalog's pills (type; "Not watched yet") and
 * the sort. It reads the servers' index itself, the one `?watch=now` filters the catalog's shelves by, a page at a time
 * (a sort or "Not watched yet" first loads the rest, so they work on all of it). A server out of reach or not indexed
 * yet is said over the grid; no servers — the way to connect one (an adult's tool, not offered to a kids profile).
 * That a copy in the index doesn't prove the file plays on this device is for a screen reader (1.2).
 */
export function ServersTab() {
  const t = useTranslations();
  const tl = useTranslations("library");
  const locale = useLocale();
  const kids = Boolean(useSession().me?.activeProfile?.isKids);
  const { params, set } = useUrlState();
  const filters = readFilters(params);
  const sort = readSort<Sort>(params, SORTS, "added");
  const sorts = useTitleSorts();
  const q = useInfiniteQuery({
    queryKey: ["on-servers", "all", filters.show],
    queryFn: ({ pageParam }) =>
      api<Page>(`/api/library/on-servers?limit=${PAGE}&offset=${pageParam}${filters.show ? `&kind=${filters.show}` : ""}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
  const pages = (q.data as Pages | undefined)?.pages ?? [];
  const all = [...new Map(pages.flatMap((p) => p.items).map((i) => [i.id, i])).values()];
  const first = pages[0];
  // A sort or "Not watched yet" works on all of it: the pages not here yet come first.
  const narrowed = sort !== "added" || filters.unwatched;
  const completing = narrowed && q.hasNextPage;
  const { fetchNextPage, isFetchingNextPage, isFetchNextPageError } = q;
  useEffect(() => {
    if (completing && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [completing, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  const watched = useWatchedIds(
    all.map((i) => i.id),
    filters.unwatched && !q.hasNextPage,
  );
  const items = sortItems(
    all.filter((i) => !filters.unwatched || !watched.data?.has(i.id)).map((title) => ({ title })),
    sort,
    locale,
  ).map((i) => i.title);
  const { limit, more } = useShowMore(`servers?${params.toString()}`);
  const shown = items.slice(0, limit);
  const total = first?.total ?? 0;
  const showMore = () => {
    more();
    if (limit + SHOW_PAGE >= items.length && q.hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };
  const down = (first?.sources ?? []).filter((s) => s.status === "unreachable" || s.status === "unauthorized");
  const pending = (first?.sources ?? []).filter((s) => !s.indexed);

  return (
    <QueryState
      query={q}
      loading={<GridSkeleton toolbar />}
      error={{ title: tl("loadError") }}
      isEmpty={(d) => (d as Pages).pages[0]!.sources.length === 0}
      empty={
        // No servers yet: connecting one is the way (an adult's tool); a kids profile has nothing to do here.
        <EmptyState
          icon={Server}
          title={kids ? tl("serversEmpty") : t("title.noServers").replace(/\.$/, "")}
          action={
            !kids && (
              <Link href="/settings/connections" className={buttonClass("primary")}>
                {t("title.connectServer")}
              </Link>
            )
          }
        />
      }
    >
      {() => (
        <div>
          <p className="sr-only">{t("rows.watchNowNote")}</p>
          {(down.length > 0 || pending.length > 0) && (
            <div className="mb-6 flex flex-col gap-3">
              {down.length > 0 && (
                <InlineAlert
                  tone="warning"
                  title={t("title.serversDown", { names: down.map((s) => s.name).join(", ") })}
                  action={
                    !kids && (
                      <Link href="/settings/connections" className={buttonClass("tertiary", "sm")}>
                        {t("nav.connections")}
                      </Link>
                    )
                  }
                />
              )}
              {pending.length > 0 && <InlineAlert title={t("title.serversIndexing", { names: pending.map((s) => s.name).join(", ") })} />}
            </div>
          )}
          {total === 0 && !filters.show ? (
            <EmptyState icon={Server} title={tl("serversEmpty")} />
          ) : (
            <>
              <CollectionToolbar
                filters={filters}
                set={set}
                unwatched
                sort={{ value: sort, onChange: (v) => set({ sort: v === "added" ? null : v }), options: sorts({ value: "added" }) }}
                shown={narrowed && !q.hasNextPage ? items.length : total}
                total={total}
              />
              {completing && !isFetchNextPageError ? (
                <GridSkeleton />
              ) : items.length === 0 && !q.hasNextPage ? (
                <EmptyState
                  icon={Server}
                  title={tl("filterEmpty")}
                  action={
                    <Button variant="secondary" onClick={() => set({ show: null, unwatched: null })}>
                      {t("common.resetFilters")}
                    </Button>
                  }
                />
              ) : (
                <>
                  <ListGrid>
                    {shown.map((item) => (
                      <Card key={item.id} title={plain(item)} />
                    ))}
                  </ListGrid>
                  {/* The next 60: drawn from what is here, then the index's next page; one that didn't come — Retry here (8.4). */}
                  <LoadMore
                    onMore={showMore}
                    onRetry={() => void fetchNextPage()}
                    loading={isFetchingNextPage}
                    failed={isFetchNextPageError}
                    hasMore={shown.length < items.length || q.hasNextPage}
                    shown={shown.length}
                    total={narrowed ? items.length : total}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
    </QueryState>
  );
}
