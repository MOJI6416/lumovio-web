"use client";

import type { HistoryEntry } from "@lumovio/contracts";
import { type InfiniteData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { History, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { PosterCard } from "@/components/media/PosterCard";
import { useSession } from "@/components/providers/Providers";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadMore } from "@/components/ui/LoadMore";
import { QueryState } from "@/components/ui/QueryState";
import { libraryKey } from "@/hooks/useLibraryState";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { randomId } from "@/lib/random-id";
import { useAction } from "@/lib/use-action";
import { GridSkeleton } from "./GridSkeleton";
import { type Group, groupHistory } from "./history";
import { useHistoryCaption, useMonthName } from "./history-words";
import { ListGrid } from "./ListGrid";

type Page = { entries: HistoryEntry[]; nextBefore: string | null };
type Pages = InfiniteData<Page>;

/** A card that doesn't draw again when "Show more" adds the next ones. */
const Card = memo(PosterCard);

/**
 * History (S09, LIB-05, LIB-11): what was watched, as posters by month, newest first — a card per title and day, its
 * line the day and what of it ("Yesterday · Season 1 · episodes 1–3", a film twice "2 times"), so a title is found by
 * its art, not read out of rows. "Remove from history" is in the card's "More", seen on touch screens too: gone at
 * once, with "Undo" in the toast (8.3). The server sends 50 watches a page; "Show more" asks for the next.
 */
export function HistoryTab() {
  const t = useTranslations("library");
  const kids = Boolean(useSession().me?.activeProfile?.isKids);
  const qc = useQueryClient();
  const caption = useHistoryCaption();
  const monthName = useMonthName();
  const q = useInfiniteQuery({
    queryKey: ["history"],
    queryFn: ({ pageParam }) => api<Page>(`/api/history?limit=50${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });

  // A card goes in one request, and "Undo" brings all of it back in one (LIB-25): the server keeps what it removed
  // under the key this removal chose.
  const remove = useAction({
    run: async (g: Group) => {
      const undoKey = randomId();
      // The card's whole local day of this title, so a day the page boundary cut goes whole (LIB-27).
      const from = new Date(`${g.day}T00:00:00`);
      const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
      const span = { titleId: g.title.id, from: from.toISOString(), to: to.toISOString() };
      await api("/api/history/remove", { method: "POST", json: { ids: g.entries.map((e) => e.id), undoKey, span } });
      void qc.invalidateQueries({ queryKey: libraryKey(g.title.id) });
      return undoKey;
    },
    optimistic: (g: Group) => {
      const ids = new Set(g.entries.map((e) => e.id));
      // The sync after the request brings the next pages back without the rest of the day.
      const before = qc.getQueryData<Pages>(["history"]);
      void qc.cancelQueries({ queryKey: ["history"], exact: true });
      qc.setQueryData<Pages>(["history"], (d) => d && { ...d, pages: d.pages.map((p) => ({ ...p, entries: p.entries.filter((x) => !ids.has(x.id)) })) });
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

  return (
    <QueryState
      query={q}
      loading={<GridSkeleton />}
      isEmpty={(d) => d.pages.every((p) => p.entries.length === 0)}
      error={{ title: t("loadError") }}
      empty={
        <EmptyState
          icon={History}
          title={t("emptyHistory")}
          // Import is an adult's tool: a kids profile isn't pointed to it. The ways to fill it are the actions.
          about={kids ? t("emptyHistoryHintKids") : t("emptyHistoryHint")}
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
      {(d) => {
        // Days, then months: a card per title and day (LIB-11), the days of a month under its name.
        const months: { month: string; groups: Group[] }[] = [];
        for (const { day, groups } of groupHistory(d.pages.flatMap((p) => p.entries))) {
          const month = day.slice(0, 7);
          const last = months.at(-1);
          if (last?.month === month) last.groups.push(...groups);
          else months.push({ month, groups: [...groups] });
        }
        return (
          <div className="flex flex-col gap-10">
            {months.map(({ month, groups }) => (
              <section key={month} aria-labelledby={`history-${month}`}>
                <h2 id={`history-${month}`} className="mb-4 text-h3 text-text-1 first-letter:uppercase">
                  {monthName(`${month}-01`)}
                </h2>
                <ListGrid>
                  {groups.map((g) => (
                    <Card
                      key={g.key}
                      title={g.title}
                      subtitle={caption(g)}
                      // Everything here is watched: the card's own "Watched" mark would only repeat it.
                      showState={false}
                      more={{ remove: { label: t("removeFromHistory"), run: () => void remove.run(g) } }}
                      moreVisibility="always"
                    />
                  ))}
                </ListGrid>
              </section>
            ))}
            <LoadMore
              className="flex justify-center"
              onMore={() => void q.fetchNextPage()}
              loading={q.isFetchingNextPage}
              failed={q.isFetchNextPageError}
              hasMore={q.hasNextPage}
            />
          </div>
        );
      }}
    </QueryState>
  );
}
