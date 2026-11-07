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
import { groupHistory } from "./history";
import { useHistoryCaption } from "./history-words";
import { NewListTile } from "./NewListTile";
import { RatingBadge } from "./RatingBadge";
import { onServersQuery, systemListQuery } from "./whole-list";

const day = (offset: number) => localDay(new Date(Date.now() + offset * 864e5));
/** Cards a collection's shelf shows; its heading opens the rest. */
const SHELF = 20;

interface RatingRow {
  title: TitleSummary;
  value: number;
  ratedAt: string;
}

/**
 * The library's screen (S09, design-system 9 "Library"): what is the profile's own, as shelves — "Continue watching"
 * (one shelf, as on the home page), "On my servers" (what plays in one press, "Watch now" since 2026-11-07), new
 * episodes of its shows, then Watchlist, Favourites, Lists, History and Ratings.
 * Each collection's heading is the link to all of it (7.13), a page of its own; an empty one isn't shown, except Lists,
 * which starts with "New list". A new profile gets the ways to start. One error for the whole screen (LIB-09).
 */
export function LibraryOverview() {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const tcard = useTranslations("card");
  const locale = useLocale();
  const { me } = useSession();
  const isKids = Boolean(me?.activeProfile?.isKids);
  const caption = useHistoryCaption();
  const today = day(0);
  const cont = useQuery({ queryKey: ["continue"], queryFn: () => api<{ items: ContinueWatchingItem[] }>("/api/continue") });
  const watchlist = useQuery(systemListQuery("watchlist"));
  const favorites = useQuery(systemListQuery("favorites"));
  const history = useQuery({ queryKey: ["history", "recent"], queryFn: () => api<{ entries: HistoryEntry[] }>("/api/history?limit=60") });
  const ratings = useQuery({ queryKey: ["ratings"], queryFn: () => api<{ ratings: RatingRow[] }>("/api/library/ratings"), refetchInterval: untilComplete });
  const lists = useQuery({ queryKey: ["lists"], queryFn: () => api<{ lists: ListSummary[] }>("/api/lists"), refetchInterval: untilComplete });
  const servers = useQuery(onServersQuery);
  const conns = useQuery({
    queryKey: ["connections"],
    queryFn: () => api<{ connections: ConnectionSummary[] }>("/api/connections"),
    enabled: !isKids,
  });
  const recent = useQuery({
    queryKey: ["calendar", "recent", today, locale],
    queryFn: () => api<{ events: CalendarEvent[] }>(`/api/calendar?from=${day(-7)}&to=${today}`),
  });
  // The week's new episodes are waited for a moment only: a cold calendar of a profile with many shows took 17 s, and
  // the whole screen waited for it (stand QA, 2026-11-06). Later, its shelf comes in where it belongs.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const parts = [cont, servers, watchlist, favorites, history, ratings, lists];
  const failed = parts.filter((q) => q.isError);
  const retrying = failed.some((q) => q.isFetching);
  const retry = () => {
    for (const q of failed) void q.refetch();
    if (recent.isError) void recent.refetch();
  };

  if (parts.some((q) => q.isLoading) || conns.isLoading || (recent.isLoading && !waited)) return <OverviewSkeleton />;
  if (failed.length === parts.length) return <ErrorState error={failed[0]?.error} title={t("loadError")} onRetry={retry} retrying={retrying} />;

  const items = cont.data?.items ?? [];
  const shown = new Set(items.map((i) => i.title.id));
  // Newest aired episode per tracked show this week, unless that show is already in "Continue watching".
  // An episode airing tonight isn't "new" this morning: an exact start must have passed.
  const fresh = [...(recent.data?.events ?? [])]
    .filter((e) => e.kind === "episode" && !e.special && hasAired(e) && !shown.has(e.title.id))
    .sort((a, b) => (b.airstamp ?? b.date).localeCompare(a.airstamp ?? a.date))
    .filter((e, i, a) => a.findIndex((x) => x.title.id === e.title.id) === i);
  const saved = watchlist.data?.items ?? [];
  const loved = favorites.data?.items ?? [];
  const own = (lists.data?.lists ?? []).filter((l) => l.kind === "custom");
  // The latest day of each title watched, newest first: the shelf is what was watched lately, not every episode.
  const watched = groupHistory(history.data?.entries ?? [])
    .flatMap((d) => d.groups)
    .filter((g, i, a) => a.findIndex((x) => x.title.id === g.title.id) === i);
  const rated = ratings.data?.ratings ?? [];
  // What plays from the servers in one press, newest first; "On your server" would only repeat the shelf's name.
  const copies = (servers.data?.items ?? []).map((t) => (t.onServer ? { ...t, onServer: false } : t));
  const isNew = failed.length === 0 && items.length + copies.length + saved.length + loved.length + watched.length + rated.length + own.length === 0;
  const yesterday = day(-1);
  const when = (e: CalendarEvent) => {
    const d = eventDay(e);
    return d === today ? tc("today") : d === yesterday ? tc("yesterday") : formatDate(d, locale, { day: "numeric", month: "short" });
  };

  if (isNew) {
    const connected = (conns.data?.connections.length ?? 0) > 0;
    return (
      // Nothing yet: what the library will hold is the heading; the ways to start are its actions. Import and servers
      // are an adult's tools: a kids profile isn't pointed to them; no "connect" once a server is.
      <EmptyState
        icon={Library}
        title={t("overviewEmpty")}
        action={
          <Link href="/search" className={buttonClass("primary")}>
            <Search aria-hidden />
            {t("findTitles")}
          </Link>
        }
        secondaryAction={
          !isKids && (
            <>
              <Link href="/import" className={buttonClass("tertiary")}>
                {t("startImportCta")}
              </Link>
              {!connected && (
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

  return (
    <div className="flex flex-col gap-8">
      {(failed.length > 0 || recent.isError) && (
        <InlineAlert
          tone="danger"
          title={t("loadErrorPart")}
          action={
            <Button variant="tertiary" size="sm" loading={retrying} onClick={retry}>
              {tc("retry")}
            </Button>
          }
        />
      )}
      {/* The shelves run to the screen's edges out of the page gutter; each shelf keeps its own edge (5.3). */}
      <div className="-mx-(--gutter) flex flex-col gap-8 md:gap-12">
        {items.length > 0 && <ContinueRow id="lib-continue" items={items} />}
        {copies.length > 0 && (
          <Row id="lib-servers" title={t("servers")} href="/library?tab=servers">
            {copies.slice(0, SHELF).map((item) => (
              <PosterCard key={item.id} title={item} />
            ))}
          </Row>
        )}
        {fresh.length > 0 && (
          <Row id="lib-new" kind="landscape" title={t("nowNewEpisodes")} note={t("nowNewEpisodesNote")} href="/calendar">
            {fresh.map((e) => {
              const meta = [e.season !== null && e.episode !== null ? tcard("episode", { season: e.season, episode: e.episode }) : null, when(e)];
              return (
                <LandscapeCard
                  key={e.title.id}
                  title={e.title}
                  href={`${titleHref(e.title.kind, e.title.tmdbId, e.title.title)}#episodes`}
                  meta={meta}
                  label={[e.title.title, ...meta].filter(Boolean).join(", ")}
                />
              );
            })}
          </Row>
        )}
        {saved.length > 0 && (
          <Row id="lib-watchlist" title={t("watchlist")} href="/library?tab=watchlist">
            {saved.slice(0, SHELF).map((i) => (
              <PosterCard key={i.title.id} title={i.title} />
            ))}
          </Row>
        )}
        {loved.length > 0 && (
          <Row id="lib-favorites" title={t("favorites")} href="/library?tab=favorites">
            {loved.slice(0, SHELF).map((i) => (
              <PosterCard key={i.title.id} title={i.title} />
            ))}
          </Row>
        )}
        {/* Always there once the profile has anything: "New list" is where a list is made. */}
        <Row id="lib-lists" title={t("lists")} href={own.length > 0 ? "/library?tab=lists" : null}>
          <NewListTile />
          {own.slice(0, SHELF).map((l) => (
            <ListCard key={l.id} list={l} />
          ))}
        </Row>
        {watched.length > 0 && (
          <Row id="lib-history" title={t("history")} href="/library?tab=history">
            {watched.slice(0, SHELF).map((g) => (
              <PosterCard key={g.key} title={g.title} subtitle={caption(g)} showState={false} />
            ))}
          </Row>
        )}
        {rated.length > 0 && (
          <Row id="lib-ratings" title={t("ratings")} href="/library?tab=ratings">
            {rated.slice(0, SHELF).map((r) => (
              <PosterCard key={r.title.id} title={r.title}>
                <RatingBadge title={r.title} value={r.value} onSaved={() => void ratings.refetch()} />
              </PosterCard>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}
