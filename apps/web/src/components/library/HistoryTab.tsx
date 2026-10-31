"use client";

import type { HistoryEntry } from "@lumovio/contracts";
import { type InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, History, Info, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Poster } from "@/components/media/Poster";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { QueryState } from "@/components/ui/QueryState";
import { libraryKey } from "@/hooks/useLibraryState";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatDate, localDay } from "@/lib/format";
import { titleHref } from "@/lib/slug";
import { useAction } from "@/lib/use-action";
import { randomId } from "@/lib/random-id";
import { ROW, ROW_GRID, RowsSkeleton } from "./GridSkeleton";
import { episodesOf, type Group, groupHistory } from "./history";

type Page = { entries: HistoryEntry[]; nextBefore: string | null };
type Pages = InfiniteData<Page>;

/** Import sources as their services write their names (LIB-11: "Импорт из trakt"). */
export const SOURCE_NAMES: Record<string, string> = {
  trakt: "Trakt",
  simkl: "Simkl",
  imdb: "IMDb",
  letterboxd: "Letterboxd",
  netflix: "Netflix",
  lampa: "Lampa",
  stremio: "Stremio",
  lumovio: "Lumovio",
  jellyfin: "Jellyfin",
  plex: "Plex",
};

/**
 * History (S09, LIB-05, LIB-11): days, newest first; in a day one row per title — a film watched twice says "2 times",
 * a show's episodes are one row ("Season 1 · episodes 4–6"). Every row has "More" on every screen: "More info" and
 * "Remove from history", gone at once with "Undo" in the toast (8.3).
 */
export function HistoryTab() {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const tcard = useTranslations("card");
  const locale = useLocale();
  const kids = Boolean(useSession().me?.activeProfile?.isKids);
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["history"],
    queryFn: ({ pageParam }) =>
      api<Page>(`/api/history?limit=50${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });

  // A row goes in one request, and "Undo" brings all of it back in one (LIB-25): the server keeps what it removed
  // under the key this removal chose.
  const remove = useAction({
    run: async (g: Group) => {
      const undoKey = randomId();
      // The row's whole local day of this title, so a row the page boundary cut goes whole (LIB-27).
      const from = new Date(`${g.day}T00:00:00`);
      const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
      const span = { titleId: g.title.id, from: from.toISOString(), to: to.toISOString() };
      await api("/api/history/remove", { method: "POST", json: { ids: g.entries.map((e) => e.id), undoKey, span } });
      void qc.invalidateQueries({ queryKey: libraryKey(g.title.id) });
      return undoKey;
    },
    optimistic: (g: Group) => {
      const ids = new Set(g.entries.map((e) => e.id));
      // The sync after the request brings the next pages back without the rest of the row.
      const before = qc.getQueryData<Pages>(["history"]);
      void qc.cancelQueries({ queryKey: ["history"], exact: true });
      qc.setQueryData<Pages>(
        ["history"],
        (d) =>
          d && {
            ...d,
            pages: d.pages.map((p) => ({ ...p, entries: p.entries.filter((x) => !ids.has(x.id)) })),
          },
      );
      return () => qc.setQueryData<Pages>(["history"], before);
    },
    success: (_, g) => t("entryRemoved", { title: g.title.title }),
    undo: async (undoKey, g) => {
      await api("/api/history/restore", { method: "POST", json: { undoKey } });
      void qc.invalidateQueries({ queryKey: libraryKey(g.title.id) });
    },
    error: (_, g) => t("entryRemoveFailed", { title: g.title.title }),
    sync: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });

  const today = localDay();
  const yesterday = localDay(new Date(Date.now() - 864e5));
  const year = String(new Date().getFullYear());
  const dayLabel = (day: string) =>
    day === today
      ? tc("today")
      : day === yesterday
        ? tc("yesterday")
        : (formatDate(
            day,
            locale,
            day.startsWith(year)
              ? { weekday: "long", day: "numeric", month: "long" }
              : { day: "numeric", month: "long", year: "numeric" },
          ) ?? day);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const sourceLabel = (s: string) =>
    s === "manual"
      ? t("sourceManual")
      : s.startsWith("lumovio_player")
        ? t("sourcePlayer")
        : s === "external_player"
          ? t("sourceExternal")
          : s.startsWith("import:")
            ? t("sourceImport", { source: SOURCE_NAMES[s.slice(7)] ?? s.slice(7) })
            : (SOURCE_NAMES[s] ?? null);
  const meta = (g: Group) => {
    const last = g.entries[0]!;
    const eps = episodesOf(g.entries);
    const what =
      g.title.kind === "movie"
        ? g.entries.length > 1
          ? t("historyTimes", { count: g.entries.length })
          : tc("movie")
        : eps.kind === "one"
          ? tcard("episode", { season: eps.season, episode: eps.episode })
          : eps.kind === "range"
            ? t("historyEpisodeRange", { season: eps.season, from: eps.from, to: eps.to })
            : eps.kind === "many"
              ? tc("episodes", { count: eps.count })
              : t("historyWholeShow");
    const sources = new Set(g.entries.map((e) => sourceLabel(e.source)));
    return [what, time.format(new Date(last.watchedAt)), sources.size === 1 ? [...sources][0] : null]
      .filter(Boolean)
      .join(" · ");
  };

  return (
    <QueryState
      query={q}
      loading={<RowsSkeleton />}
      isEmpty={(d) => d.pages.every((p) => p.entries.length === 0)}
      error={{ title: t("loadError") }}
      empty={
        <EmptyState
          icon={History}
          title={t("emptyHistory")}
          // Import is an adult's tool: a kids profile isn't pointed to it.
          text={kids ? t("emptyHistoryHintKids") : t("emptyHistoryHint")}
          action={
            <Link href="/search" className={buttonClass("primary")}>
              <Search aria-hidden />
              {t("findTitles")}
            </Link>
          }
          secondaryAction={
            !kids && (
              <Link href="/import" className={buttonClass("tertiary")}>
                {t("startImportCta")}
              </Link>
            )
          }
        />
      }
    >
      {(d) => (
        <div className="space-y-8">
          {groupHistory(d.pages.flatMap((p) => p.entries)).map(({ day, groups }) => (
            <section key={day} aria-labelledby={`h-${day}`}>
              <h2 id={`h-${day}`} className="mb-2 text-title text-text-1 first-letter:uppercase">
                {dayLabel(day)}
              </h2>
              {/* Rows across the page's width: two columns from xl, three from 2xl (owner, 2026-10-25). */}
              <ul className={ROW_GRID}>
                {groups.map((g) => {
                  const href = titleHref(g.title.kind, g.title.tmdbId, g.title.title);
                  return (
                    <li key={g.key} className={ROW}>
                      {/* The poster, the name and the line under it are one link to the title; the controls stand beside it. */}
                      <Link
                        href={href}
                        className="group/row flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-sm py-1"
                      >
                        <div className="w-10 shrink-0 overflow-hidden rounded-sm">
                          <Poster path={g.title.posterPath} title="" kind={g.title.kind} sizes="40px" />
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-title text-text-1 group-hover/row:underline">
                            {g.title.title}
                          </span>
                          <span className="block text-body-s text-text-2">{meta(g)}</span>
                        </span>
                      </Link>
                      <div className="relative">
                        <Menu
                          label={t("historyMenu")}
                          title={g.title.title}
                          trigger={
                            <IconButton icon={Ellipsis} label={tcard("more", { title: g.title.title })} />
                          }
                        >
                          <MenuItem icon={Info} href={href}>
                            {tcard("details")}
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem icon={Trash2} tone="danger" onSelect={() => void remove.run(g)}>
                            {t("removeFromHistory")}
                          </MenuItem>
                        </Menu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {q.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                loading={q.isFetchingNextPage}
                onClick={() => void q.fetchNextPage()}
              >
                {tc("showMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </QueryState>
  );
}
