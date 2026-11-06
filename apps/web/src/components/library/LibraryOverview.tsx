"use client";

import type { CalendarEvent, ConnectionSummary, ContinueWatchingItem, HistoryEntry, ListSummary, TitleSummary } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { Library, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ContinueRow } from "@/components/media/ContinueRow";
import { LandscapeCard } from "@/components/media/LandscapeCard";
import { ListCard } from "@/components/media/ListCard";
import { PosterCard } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { eventDay, formatDate, hasAired, localDay } from "@/lib/format";
import { untilComplete } from "@/lib/incomplete";
import { titleHref } from "@/lib/slug";
import { OverviewSkeleton } from "./GridSkeleton";
import { systemListQuery } from "./whole-list";

const day = (offset: number) => localDay(new Date(Date.now() + offset * 864e5));

/**
 * Whether the profile is new: nothing in progress, saved, favourited, watched, rated or listed. A failed request is not
 * "empty" — then the profile is not called new. The tabs read the same queries (same keys).
 */
export function useLibraryStart() {
  const { me } = useSession();
  const isKids = Boolean(me?.activeProfile?.isKids);
  const cont = useQuery({ queryKey: ["continue"], queryFn: () => api<{ items: ContinueWatchingItem[] }>("/api/continue") });
  const watchlist = useQuery(systemListQuery("watchlist"));
  const favorites = useQuery(systemListQuery("favorites"));
  const history = useQuery({ queryKey: ["history", "any"], queryFn: () => api<{ entries: HistoryEntry[] }>("/api/history?limit=1") });
  const ratings = useQuery({ queryKey: ["ratings"], queryFn: () => api<{ ratings: unknown[] }>("/api/library/ratings"), refetchInterval: untilComplete });
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => api<{ lists: ListSummary[] }>("/api/lists"), refetchInterval: untilComplete });
  const conns = useQuery({
    queryKey: ["connections"],
    queryFn: () => api<{ connections: ConnectionSummary[] }>("/api/connections"),
    enabled: !isKids,
  });
  const parts = [cont, watchlist, favorites, history, ratings, lists];
  const failed = parts.filter((q) => q.isError);
  const isNew =
    parts.every((q) => q.isSuccess) &&
    (cont.data?.items.length ?? 0) === 0 &&
    (watchlist.data?.items.length ?? 0) === 0 &&
    (favorites.data?.items.length ?? 0) === 0 &&
    (history.data?.entries.length ?? 0) === 0 &&
    (ratings.data?.ratings.length ?? 0) === 0 &&
    !lists.data?.lists.some((l) => l.kind === "custom");
  return {
    cont,
    watchlist,
    favorites,
    lists,
    isKids,
    isNew,
    loading: parts.some((q) => q.isLoading) || conns.isLoading,
    failed: failed.length,
    allFailed: failed.length === parts.length,
    error: failed[0]?.error,
    retrying: failed.some((q) => q.isFetching),
    retry: () => {
      for (const q of failed) void q.refetch();
    },
    connected: (conns.data?.connections.length ?? 0) > 0,
  };
}

/**
 * The library's "Overview" tab (S09; LIB-02, LIB-03, LIB-23): the next thing to do, in order — finish what is in
 * progress, the next aired episode, new episodes of tracked shows, what just arrived on the profile's servers — and a
 * look into the collections, each with "All" to its tab. It sits under the tabs, so nothing moves the tabs while it
 * loads; until everything is in, a skeleton of the same shelves stands there. A new profile gets the ways to start
 * (EmptyState): find, import, connect a server — as they fit the profile. One error for the whole tab (LIB-09).
 */
export function LibraryOverview() {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const tcard = useTranslations("card");
  const locale = useLocale();
  const start = useLibraryStart();
  const today = day(0);
  const recent = useQuery({
    queryKey: ["calendar", "recent", today, locale],
    queryFn: () => api<{ events: CalendarEvent[] }>(`/api/calendar?from=${day(-7)}&to=${today}`),
  });
  const servers = useQuery({ queryKey: ["on-servers"], queryFn: () => api<{ items: TitleSummary[] }>("/api/library/on-servers") });
  // The week's new episodes are waited for a moment only: a cold calendar of a profile with many shows took 17 s, and
  // the whole overview waited for it (stand QA, 2026-11-06). Later, its shelf comes in where it belongs.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  if (start.loading || servers.isLoading || (recent.isLoading && !waited)) return <OverviewSkeleton />;
  if (start.allFailed) return <ErrorState error={start.error} title={t("loadError")} onRetry={start.retry} retrying={start.retrying} />;

  if (start.isNew) {
    return (
      <EmptyState
        icon={Library}
        title={t("startTitle")}
        text={start.isKids ? t("startTextKids") : start.connected ? t("startTextNoConnect") : t("startText")}
        action={
          <Link href="/search" className={buttonClass("primary")}>
            <Search aria-hidden />
            {t("findTitles")}
          </Link>
        }
        // Import and servers are an adult's tools: a kids profile isn't pointed to them; no "connect" once a server is.
        secondaryAction={
          !start.isKids && (
            <>
              <Link href="/import" className={buttonClass("tertiary")}>
                {t("startImportCta")}
              </Link>
              {!start.connected && (
                <Link href="/settings/connections" className={buttonClass("tertiary")}>
                  {t("startConnectCta")}
                </Link>
              )}
            </>
          )
        }
      />
    );
  }

  const items = start.cont.data?.items ?? [];
  // An unfinished episode and a new next episode are different decisions, so they get separate shelves.
  const inProgress = items.filter((i) => !i.next);
  const nextUp = items.filter((i) => i.next);
  const shown = new Set(items.map((i) => i.title.id));
  // Newest aired episode per tracked show this week, unless that show is already in "next episode".
  // An episode airing tonight isn't "new" this morning: an exact start must have passed.
  const fresh = [...(recent.data?.events ?? [])]
    .filter((e) => e.kind === "episode" && !e.special && hasAired(e) && !shown.has(e.title.id))
    .sort((a, b) => (b.airstamp ?? b.date).localeCompare(a.airstamp ?? a.date))
    .filter((e, i, a) => a.findIndex((x) => x.title.id === e.title.id) === i);
  const onServers = servers.data?.items ?? [];
  const watchlist = start.watchlist.data?.items ?? [];
  const favorites = start.favorites.data?.items ?? [];
  const lists = (start.lists.data?.lists ?? []).filter((l) => l.kind === "custom");
  const any = inProgress.length + nextUp.length + fresh.length + onServers.length + watchlist.length + favorites.length + lists.length > 0;
  const yesterday = day(-1);
  const when = (e: CalendarEvent) => {
    const d = eventDay(e);
    return d === today ? tc("today") : d === yesterday ? tc("yesterday") : formatDate(d, locale, { day: "numeric", month: "short" });
  };

  return (
    <div className="flex flex-col gap-8">
      {(start.failed > 0 || servers.isError || recent.isError) && (
        <InlineAlert
          tone="danger"
          title={t("loadErrorPart")}
          action={
            <Button
              variant="tertiary"
              size="sm"
              loading={start.retrying}
              onClick={() => {
                start.retry();
                if (servers.isError) void servers.refetch();
                if (recent.isError) void recent.refetch();
              }}
            >
              {tc("retry")}
            </Button>
          }
        />
      )}
      {!any ? (
        <EmptyState
          icon={Library}
          title={t("overviewEmpty")}
          text={t("overviewEmptyText")}
          action={
            <Link href="/search" className={buttonClass("primary")}>
              <Search aria-hidden />
              {t("findTitles")}
            </Link>
          }
          secondaryAction={
            <Link href="/library?tab=history" className={buttonClass("tertiary")}>
              {t("openHistory")}
            </Link>
          }
        />
      ) : (
        // The shelves run to the screen's edges out of the page gutter; each shelf keeps its own edge (5.3).
        <div className="-mx-(--gutter) flex flex-col gap-8 md:gap-12">
          {inProgress.length > 0 && <ContinueRow id="lib-continue" title={t("nowContinue")} items={inProgress} />}
          {nextUp.length > 0 && <ContinueRow id="lib-next" title={t("nowNextUp")} items={nextUp} />}
          {fresh.length > 0 && (
            <Row id="lib-new" kind="landscape" title={t("nowNewEpisodes")} note={t("nowNewEpisodesNote")} href="/calendar">
              {fresh.map((e) => {
                const meta = [e.season !== null && e.episode !== null ? tcard("episode", { season: e.season, episode: e.episode }) : null, when(e)];
                return (
                  <LandscapeCard
                    key={e.title.id}
                    title={e.title}
                    href={`${titleHref(e.title.kind, e.title.tmdbId, e.title.title)}?tab=episodes`}
                    meta={meta}
                    label={[e.title.title, ...meta].filter(Boolean).join(", ")}
                  />
                );
              })}
            </Row>
          )}
          {onServers.length > 0 && (
            <Row id="lib-servers" title={t("nowOnServers")}>
              {onServers.map((item) => (
                <PosterCard key={item.id} title={item} />
              ))}
            </Row>
          )}
          {watchlist.length > 0 && (
            <Row id="lib-watchlist" title={t("watchlist")} href="/library?tab=watchlist">
              {watchlist.slice(0, 20).map((i) => (
                <PosterCard key={i.title.id} title={i.title} />
              ))}
            </Row>
          )}
          {favorites.length > 0 && (
            <Row id="lib-favorites" title={t("favorites")} href="/library?tab=favorites">
              {favorites.slice(0, 20).map((i) => (
                <PosterCard key={i.title.id} title={i.title} />
              ))}
            </Row>
          )}
          {lists.length > 0 && (
            <Row id="lib-lists" title={t("lists")} href="/library?tab=lists">
              {lists.slice(0, 20).map((l) => (
                <ListCard key={l.id} list={l} />
              ))}
            </Row>
          )}
        </div>
      )}
    </div>
  );
}
