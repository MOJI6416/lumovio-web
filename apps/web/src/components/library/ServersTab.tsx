"use client";

import type { ConnectionSummary, SourceState, TitleSummary } from "@lumovio/contracts";
import { type InfiniteData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Server, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { memo, useEffect, useState } from "react";
import type { TorrentConnection } from "@/components/connections/RemoveTorrentsDialog";
import { PosterCard } from "@/components/media/PosterCard";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Link as ActionLink } from "@/components/ui/Link";
import { LoadMore } from "@/components/ui/LoadMore";
import { QueryState } from "@/components/ui/QueryState";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { invalidateAvailability, loadTorrentManager, type ManagedTorrent, type TorrentManagerData } from "@/lib/media/torrent-manage";
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

// The torrent removal (its confirmation and per-torrent results) loads when a removal is asked for.
const RemoveTorrentsDialog = dynamic(() => import("@/components/connections/RemoveTorrentsDialog").then((m) => m.RemoveTorrentsDialog), { ssr: false });

/** One server's part of a removal: its torrents of the chosen titles. */
type Removal = { connection: TorrentConnection; torrents: ManagedTorrent[]; titles: TorrentManagerData["titles"] };

/**
 * "On my servers": everything already on the
 * profile's own servers that plays in one press — films, series, anime — as Apple TV's library and Plex's do it: the
 * collection's grid, newest copy first ("Added 22 Oct" under each), the catalog's pills (type; "Not watched yet") and
 * the sort. It reads the servers' index itself, the one `?watch=now` filters the catalog's shelves by, a page at a time
 * (a sort or "Not watched yet" first loads the rest, so they work on all of it). A server out of reach or not indexed
 * yet is said over the grid; no servers — the way to connect one (an adult's tool, not offered to a kids profile).
 * That a copy in the index doesn't prove the file plays on this device is for a screen reader.
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
  const qc = useQueryClient();
  // "Select": titles whose torrents are on the profile's TorrServers, removed from there through
  // RemoveTorrentsDialog. Jellyfin and Plex copies aren't removed here (deleting their files is the server's
  // business).
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [removals, setRemovals] = useState<Removal[]>([]);
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
  const torrServers = kids ? [] : (first?.sources ?? []).filter((s) => s.kind === "torrserver" && s.status !== "unreachable" && s.status !== "unauthorized");
  const managers = useQuery({
    queryKey: ["on-servers", "torrents", torrServers.map((s) => s.id).join(",")],
    enabled: selecting && torrServers.length > 0,
    queryFn: async () => {
      const { connections } = await api<{ connections: ConnectionSummary[] }>("/api/connections");
      const all = await Promise.all(torrServers.map(async (s) => ({ connection: connections.find((c) => c.id === s.id), data: await loadTorrentManager(s.id) })));
      return all.flatMap((m) => (m.connection ? [{ connection: m.connection, data: m.data }] : []));
    },
  });
  // A title's torrents on each server, by the index's links.
  const torrentsOf = (titleId: string): Removal[] =>
    (managers.data ?? [])
      .map((m) => ({ connection: m.connection, titles: m.data.titles, torrents: m.data.torrents.filter((t) => t.links.some((l) => l.titleId === titleId)) }))
      .filter((r) => r.torrents.length > 0);
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const startRemoval = () => {
    const byServer = new Map<string, Removal>();
    for (const id of selected)
      for (const r of torrentsOf(id)) {
        const into = byServer.get(r.connection.id) ?? { connection: r.connection, titles: r.titles, torrents: [] };
        for (const t of r.torrents) if (!into.torrents.some((x) => x.hash === t.hash)) into.torrents.push(t);
        byServer.set(r.connection.id, into);
      }
    setRemovals([...byServer.values()]);
  };
  // "Select all", so dozens of titles aren't picked one by one: every title of the section with torrents —
  // its pages not here yet loaded first; when all are marked, the same button clears the mark.
  const selectable = items.filter((i) => torrentsOf(i.id).length > 0);
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.id));
  const [selectingAll, setSelectingAll] = useState(false);
  const selectAll = async () => {
    if (allSelected) return setSelected(new Set());
    setSelectingAll(true);
    try {
      let more = q.hasNextPage;
      while (more) more = Boolean((await fetchNextPage()).hasNextPage);
    } finally {
      setSelectingAll(false);
    }
    setPendingAll(true);
  };
  // Marked once the pages it loaded are in `items` (the next render after the last page).
  const [pendingAll, setPendingAll] = useState(false);
  useEffect(() => {
    if (!pendingAll || q.hasNextPage) return;
    setPendingAll(false);
    setSelected(new Set(selectable.map((i) => i.id)));
  }, [pendingAll, q.hasNextPage, selectable]);
  const finishRemoval = () => {
    setRemovals((rest) => rest.slice(1));
    setSelected(new Set());
    invalidateAvailability(qc);
    void qc.invalidateQueries({ queryKey: ["on-servers"] });
  };
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
          {/* A server out of reach or still indexing: one quiet line, as under the title's "Where to watch" card. */}
          {(down.length > 0 || pending.length > 0) && (
            <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-s text-text-3">
              {[down.length > 0 ? t("title.serversDown", { names: down.map((s) => s.name).join(", ") }) : null, pending.length > 0 ? t("title.serversIndexing", { names: pending.map((s) => s.name).join(", ") }) : null]
                .filter(Boolean)
                .join(" · ")}
              {!kids && down.length > 0 && (
                <ActionLink variant="action" arrow href="/settings/connections">
                  {t("title.checkConnection")}
                </ActionLink>
              )}
            </p>
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
                action={
                  torrServers.length > 0 && (
                    <span className="flex items-center gap-1">
                      {selecting && (
                        <Button variant="tertiary" size="sm" loading={selectingAll || (managers.isLoading && !managers.data)} disabled={managers.isSuccess && selectable.length === 0} onClick={() => void selectAll()}>
                          {allSelected ? t("torrentManager.clearSelection") : tl("selectAll")}
                        </Button>
                      )}
                      <Button
                        variant="tertiary"
                        size="sm"
                        onClick={() => {
                          setSelecting((v) => !v);
                          setSelected(new Set());
                        }}
                      >
                        {selecting ? t("common.done") : tl("select")}
                      </Button>
                    </span>
                  )
                }
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
                    {shown.map((item) =>
                      selecting ? (
                        <SelectableCard
                          key={item.id}
                          title={plain(item)}
                          label={tl("selectTitle", { title: item.title })}
                          selected={selected.has(item.id)}
                          disabled={!managers.data || torrentsOf(item.id).length === 0}
                          onToggle={() => toggle(item.id)}
                        />
                      ) : (
                        <Card key={item.id} title={plain(item)} />
                      ),
                    )}
                  </ListGrid>
                  {/* The next 60: drawn from what is here, then the index's next page; one that didn't come — Retry here. */}
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
          {/* The selection's action stays in sight while the grid scrolls, above the phone's bottom bar (as the server's list's). */}
          {selecting && selected.size > 0 && (
            <section
              className="sticky bottom-20 z-sticky mt-4 flex items-center gap-2 material rounded-lg p-2 md:bottom-4 md:gap-3 md:p-3"
              aria-label={tl("select")}
            >
              <IconButton icon={X} label={t("torrentManager.clearSelection")} onClick={() => setSelected(new Set())} />
              <p className="min-w-0 flex-1 text-body-s text-text-1 tabular-nums" aria-live="polite">
                {tl("selectedTitles", { count: selected.size })}
              </p>
              <Button variant="danger-tertiary" icon={Trash2} onClick={startRemoval} className="shrink-0">
                {tl("removeFromServer")}
              </Button>
            </section>
          )}
          {removals[0] && <RemoveTorrentsDialog connection={removals[0].connection} torrents={removals[0].torrents} titles={removals[0].titles} onClose={finishRemoval} />}
        </div>
      )}
    </QueryState>
  );
}

/**
 * A poster in "Select": the press marks it instead of opening the title; a title without torrents on the profile's
 * TorrServers is dimmed and can't be marked. The card itself is inert meanwhile, so neither touch nor keyboard opens it.
 */
function SelectableCard({ title, label, selected, disabled, onToggle }: { title: TitleSummary; label: string; selected: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <div className={cn("relative", disabled && "opacity-40")}>
      <div inert>
        <Card title={title} />
      </div>
      <button /* ui-lint-ignore raw-button: the poster's whole face is the toggle in Select, a card, not a Button */
        type="button"
        aria-pressed={selected}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={cn("absolute inset-0 rounded-md focus-visible:outline-(length:--focus-width) focus-visible:outline-focus disabled:cursor-not-allowed", selected && "ring-2 ring-accent")}
      >
        <span
          aria-hidden
          className={cn("absolute end-2 top-2 grid size-7 place-items-center rounded-full ring-2", selected ? "bg-accent text-on-accent ring-accent" : "stage bg-stage ring-text-1/80")}
        >
          {selected && <Check className="size-4" strokeWidth={3} />}
        </span>
      </button>
    </div>
  );
}
