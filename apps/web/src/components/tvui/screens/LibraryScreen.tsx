"use client";

import type { ContinueWatchingItem, HistoryEntry, ListDetails, ListSummary, TitleSummary } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Heart, History, Library, ListVideo, type LucideIcon, Play, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FocusEvent, type ReactNode, useState } from "react";
import { CardRating } from "@/components/media/CardRating";
import { cn } from "@/components/ui/cn";
import { TvButton } from "@/components/ui/tv/TvButton";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { tmdbImage } from "@/lib/images";
import { titleHref } from "@/lib/slug";
import { CardMoreLayer, type CardTarget, HoldHint, useHidden, useStable } from "../media/hold";
import { TvCard } from "../media/TvCard";
import { useTvNav } from "../nav/TvNav";
import { TvState } from "../shell/TvState";

const TABS = ["continue", "watchlist", "favorites", "lists", "history"] as const;
type Tab = (typeof TABS)[number];
const ICONS: Record<Tab, LucideIcon> = { continue: Play, watchlist: Bookmark, favorites: Heart, lists: ListVideo, history: History };

/*
 * The library on a TV (S08 TV; TV document §4 "Личная библиотека"): its parts as one row of tabs — Continue watching,
 * Watchlist, Favourites, Lists, History —, each a grid that starts where the tab is; an empty part says so in one line.
 * The tab is in the address (replaced), so Back from a title comes back to the same tab and card. A card of Continue
 * watching, the Watchlist, Favourites or the History has "More" (held OK, ../media/hold) with its removal; the line
 * over the grid says so.
 */
export function LibraryScreen() {
  const t = useTranslations("library");
  const tv = useTranslations("tvui");
  const params = useSearchParams();
  const nav = useTvNav();
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "continue";
  const [focused, setFocused] = useState<TitleSummary | null>(null);
  const label: Record<Tab, string> = { continue: tv("libContinue"), watchlist: tv("libWatchlist"), favorites: tv("libFavorites"), lists: tv("libLists"), history: tv("libHistory") };

  const pick = (next: Tab) => {
    if (next === tab) return;
    setFocused(null);
    nav.replaceQuery(new URLSearchParams(next === "continue" ? "" : `tab=${next}`));
  };

  return (
    <div data-tv-screen="section" className="relative h-full">
      <div data-tv-scroller className="absolute inset-0 overflow-hidden">
        <div data-tv-content data-zone-group className="flex flex-col gap-8 pb-24">
          <header data-zone-frame="top" className="flex flex-col gap-6 ps-(--tv-pad) pe-(--gutter) pt-12">
            <h1 className="text-h1 text-text-1">{t("title")}</h1>
            <div data-zone="tabs" data-zone-axis="x" data-zone-entry="current" role="tablist" aria-label={t("title")} className="flex flex-wrap gap-4">
              {TABS.map((x) => {
                const Icon = ICONS[x];
                return (
                  <TvButton
                    key={x}
                    role="tab"
                    data-key={x}
                    aria-selected={x === tab}
                    aria-pressed={x === tab}
                    data-tv-initial={x === tab || undefined}
                    className={cn("rounded-full", x === tab && "bg-selected-bg text-selected-fg")}
                    onClick={() => pick(x)}
                  >
                    <Icon aria-hidden />
                    {label[x]}
                  </TvButton>
                );
              })}
            </div>
            <div className="flex h-9 items-center gap-4 text-body-l text-text-2" aria-live="polite">
              {focused && (
                <>
                  <span className="truncate font-semibold text-text-1">{focused.title}</span>
                  {focused.year && <span>{focused.year}</span>}
                  <CardRating title={focused} className="text-text-1" />
                  {tab !== "lists" && <HoldHint className="ms-auto flex shrink-0 items-center gap-3" />}
                </>
              )}
            </div>
          </header>
          <div className="ps-(--tv-pad) pe-(--gutter)">
            {tab === "continue" && <ContinueTab onFocusTitle={setFocused} />}
            {(tab === "watchlist" || tab === "favorites") && (
              <ListTab key={tab} kind={tab} name={label[tab]} onFocusTitle={setFocused} />
            )}
            {tab === "lists" && <ListsTab />}
            {tab === "history" && <HistoryTab onFocusTitle={setFocused} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A tab's states (7.11, 8.5): the skeleton of its grid, an error with Retry, empty in one line. */
function TabState({ q, empty, icon, children }: { q: { isPending: boolean; isError: boolean; refetch: () => unknown }; empty: string | null; icon: LucideIcon; children: ReactNode }) {
  const tc = useTranslations("common");
  const tv = useTranslations("tvui");
  if (q.isPending)
    return (
      <div aria-hidden className="grid grid-cols-7 gap-x-6 gap-y-8">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="aspect-2/3 w-full animate-pulse rounded-sm bg-surface-2" />
        ))}
      </div>
    );
  if (q.isError)
    return (
      <TvState icon={RefreshCw} title={tv("loadFailed")}>
        <TvButton icon={RefreshCw} onClick={() => void q.refetch()}>
          {tc("retry")}
        </TvButton>
      </TvState>
    );
  if (empty) return <TvState icon={icon} title={empty} />;
  return <>{children}</>;
}

/** A card's "More" with its removal (../media/hold); `hide` takes the card off its tab at once. */
function MoreLayer({ more, hide, onClose }: { more: CardTarget | null; hide: (id: string) => () => void; onClose: () => void }) {
  if (!more) return null;
  return <CardMoreLayer target={more} hide={() => hide(more.title.id)} onClose={onClose} />;
}

function Grid({
  titles,
  onFocusTitle,
  onMore,
}: {
  titles: TitleSummary[];
  onFocusTitle: (t: TitleSummary | null) => void;
  onMore: (index: number) => void;
}) {
  const onFocus = (e: FocusEvent<HTMLDivElement>) => onFocusTitle(titles[Number((e.target as HTMLElement).dataset.index)] ?? null);
  return (
    <div data-zone="grid" data-zone-axis="grid" onFocus={onFocus} className="grid grid-cols-7 gap-x-6 gap-y-8">
      {titles.map((x, i) => (
        <TvCard key={x.id} title={x} index={i} fluid onMore={onMore} />
      ))}
    </div>
  );
}

function ContinueTab({ onFocusTitle }: { onFocusTitle: (t: TitleSummary | null) => void }) {
  const tv = useTranslations("tvui");
  const tk = useTranslations("card");
  const q = useQuery({ queryKey: ["continue"], queryFn: () => api<{ items: ContinueWatchingItem[] }>("/api/continue") });
  const { hidden, hide } = useHidden();
  const [more, setMore] = useState<CardTarget | null>(null);
  const items = (q.data?.items ?? []).filter((i) => !hidden.has(i.title.id));
  const onMore = useStable((i: number) => {
    const x = items[i]?.title;
    if (x) setMore({ kind: "continue", title: x, details: titleHref(x.kind, x.tmdbId, x.title) });
  });
  const onFocus = (e: FocusEvent<HTMLDivElement>) => onFocusTitle(items[Number((e.target as HTMLElement).dataset.index)]?.title ?? null);
  return (
    <>
      <TabState q={q} empty={items.length ? null : tv("libContinueEmpty")} icon={Play}>
        <div data-zone="grid" data-zone-axis="grid" onFocus={onFocus} className="grid grid-cols-4 gap-x-6 gap-y-8">
          {items.map(({ title: x, progress, next }, i) => {
            const s = next?.season ?? progress.season;
            const e = next?.episode ?? progress.episode;
            const where = s !== null && e !== null ? (next ? tk("nextEpisode", { season: s, episode: e }) : tk("episode", { season: s, episode: e })) : "";
            return (
              <TvCard
                key={x.id}
                title={x}
                shape="wide"
                index={i}
                fluid
                href={`/watch/${x.kind}/${x.tmdbId}${s !== null && e !== null ? `?s=${s}&e=${e}` : ""}`}
                label={tv("continueLabel", { title: x.title, where })}
                progress={next ? 0 : (progress.fraction ?? 0)}
                onMore={onMore}
              />
            );
          })}
        </div>
      </TabState>
      <MoreLayer more={more} hide={hide} onClose={() => setMore(null)} />
    </>
  );
}

function ListTab({ kind, name, onFocusTitle }: { kind: "watchlist" | "favorites"; name: string; onFocusTitle: (t: TitleSummary | null) => void }) {
  const tv = useTranslations("tvui");
  const q = useQuery({ queryKey: ["library-list", kind], queryFn: () => api<ListDetails>(`/api/library/${kind}`) });
  const { hidden, hide } = useHidden();
  const [more, setMore] = useState<CardTarget | null>(null);
  const titles = (q.data?.items ?? []).map((i) => i.title).filter((x) => !hidden.has(x.id));
  const onMore = useStable((i: number) => {
    const x = titles[i];
    const list = q.data;
    if (x && list) setMore({ kind: "list", title: x, list: { id: list.id, name } });
  });
  return (
    <>
      <TabState q={q} empty={titles.length ? null : kind === "watchlist" ? tv("libWatchlistEmpty") : tv("libFavoritesEmpty")} icon={kind === "watchlist" ? Bookmark : Heart}>
        <Grid titles={titles} onFocusTitle={onFocusTitle} onMore={onMore} />
      </TabState>
      <MoreLayer more={more} hide={hide} onClose={() => setMore(null)} />
    </>
  );
}

function HistoryTab({ onFocusTitle }: { onFocusTitle: (t: TitleSummary | null) => void }) {
  const tv = useTranslations("tvui");
  const q = useQuery({ queryKey: ["history-tv"], queryFn: () => api<{ entries: HistoryEntry[] }>("/api/history?limit=100") });
  const { hidden, hide } = useHidden();
  const [more, setMore] = useState<CardTarget | null>(null);
  // A title once, at its latest viewing.
  const seen = new Set<string>();
  const titles = (q.data?.entries ?? [])
    .map((e) => e.title)
    .filter((x) => !hidden.has(x.id) && (seen.has(x.id) ? false : (seen.add(x.id), true)));
  // "Remove from history" takes the title's every viewing, as the card stands for all of them.
  const onMore = useStable((i: number) => {
    const x = titles[i];
    if (!x) return;
    const ids = (q.data?.entries ?? []).filter((e) => e.title.id === x.id).map((e) => e.id);
    setMore({ kind: "history", title: x, ids });
  });
  return (
    <>
      <TabState q={q} empty={titles.length ? null : tv("libHistoryEmpty")} icon={History}>
        <Grid titles={titles} onFocusTitle={onFocusTitle} onMore={onMore} />
      </TabState>
      <MoreLayer more={more} hide={hide} onClose={() => setMore(null)} />
    </>
  );
}

function ListsTab() {
  const tv = useTranslations("tvui");
  const tc = useTranslations("common");
  const q = useQuery({ queryKey: ["lists"], queryFn: () => api<{ lists: ListSummary[] }>("/api/lists") });
  const lists = (q.data?.lists ?? []).filter((l) => l.kind === "custom");
  return (
    <TabState q={q} empty={lists.length ? null : tv("libListsEmpty")} icon={Library}>
      <div data-zone="grid" data-zone-axis="grid" className="grid grid-cols-4 gap-x-6 gap-y-8">
        {lists.map((l) => (
          <Link prefetch={false} key={l.id} href={`/lists/${l.id}`} data-key={l.id} className="tv-focus flex flex-col gap-3 rounded-md bg-surface-1 p-3">
            <span aria-hidden className="grid aspect-video grid-cols-4 gap-1 overflow-hidden rounded-sm bg-surface-2">
              {l.cover.slice(0, 4).map((p, i) => (p ? <img key={i} src={tmdbImage(p, "w185") ?? undefined} alt="" loading="lazy" className="size-full object-cover" /> : <span key={i} />))}
            </span>
            <span className="line-clamp-1 text-title text-text-1">{l.name}</span>
            <span className="text-body text-text-2 tabular-nums">{tc("titlesCount", { count: l.itemCount })}</span>
          </Link>
        ))}
      </div>
    </TabState>
  );
}
