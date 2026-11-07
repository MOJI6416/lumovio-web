"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { memo } from "react";
import { PosterCard } from "@/components/media/PosterCard";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryState } from "@/components/ui/QueryState";
import { libraryKey } from "@/hooks/useLibraryState";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { untilComplete } from "@/lib/incomplete";
import { useAction } from "@/lib/use-action";
import { CollectionToolbar } from "./CollectionToolbar";
import { GridSkeleton } from "./GridSkeleton";
import { ListGrid } from "./ListGrid";
import { RatingBadge } from "./RatingBadge";
import { ShowMore, useShowMore } from "./show-more";
import { readFilters, readSort, useUrlState } from "./url-state";

interface RatingRow {
  title: TitleSummary;
  value: number;
  source: string;
  ratedAt: string;
}
type Ratings = { ratings: RatingRow[] };

const SORTS = ["rated", "high", "low", "title"] as const;
type Sort = (typeof SORTS)[number];

/**
 * Ratings (S09, LIB-12): the rated titles as posters, the profile's own rating "★ 9" on each — the control that changes
 * it, with the title page's 1–10 dialog (8.1); "Remove rating" in the card's "More", gone at once with "Undo" in the
 * toast putting the same value back. Sorted by date, by value or by name; the type chips where both kinds are rated.
 * Drawn 60 at a time with "Show more", sorted and filtered over all of them.
 */
export function RatingsTab() {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const tb = useTranslations("browse");
  const locale = useLocale();
  const kids = Boolean(useSession().me?.activeProfile?.isKids);
  const qc = useQueryClient();
  const { params, set } = useUrlState();
  const filters = readFilters(params);
  const sort = readSort<Sort>(params, SORTS, "rated");
  const q = useQuery({ queryKey: ["ratings"], queryFn: () => api<Ratings>("/api/library/ratings"), refetchInterval: untilComplete });
  // 60 at a time (8 000 ratings were 8 400 nodes and nearly two seconds of long tasks drawn at once).
  const { limit, more } = useShowMore(`ratings?${params.toString()}`);

  const put = (titleId: string, value: number | null) => api(`/api/library/rating`, { method: "PUT", json: { titleId, value } });
  const remove = useAction({
    run: async (r: RatingRow) => {
      await put(r.title.id, null);
      void qc.invalidateQueries({ queryKey: libraryKey(r.title.id) });
    },
    optimistic: (r: RatingRow) => {
      const before = qc.getQueryData<Ratings>(["ratings"]);
      void qc.cancelQueries({ queryKey: ["ratings"], exact: true });
      qc.setQueryData<Ratings>(["ratings"], (d) => d && { ratings: d.ratings.filter((x) => x.title.id !== r.title.id) });
      return () => qc.setQueryData<Ratings>(["ratings"], before);
    },
    success: (_, r) => t("ratingRemoved", { title: r.title.title }),
    undo: async (_, r) => {
      await put(r.title.id, r.value);
      void qc.invalidateQueries({ queryKey: libraryKey(r.title.id) });
    },
    error: (_, r) => t("ratingRemoveFailed", { title: r.title.title }),
    sync: () => qc.invalidateQueries({ queryKey: ["ratings"] }),
  });
  // A rating changed in the dialog: the card shows the new value, a removed one leaves (the dialog's own request).
  const saved = (r: RatingRow, value: number | null) => {
    qc.setQueryData<Ratings>(
      ["ratings"],
      (d) => d && { ratings: value === null ? d.ratings.filter((x) => x.title.id !== r.title.id) : d.ratings.map((x) => (x.title.id === r.title.id ? { ...x, value } : x)) },
    );
    void qc.invalidateQueries({ queryKey: ["ratings"] });
  };

  const order = (rows: RatingRow[]) => {
    const shown = rows.filter((r) => !filters.show || r.title.kind === filters.show);
    if (sort === "high") return [...shown].sort((a, b) => b.value - a.value || b.ratedAt.localeCompare(a.ratedAt));
    if (sort === "low") return [...shown].sort((a, b) => a.value - b.value || b.ratedAt.localeCompare(a.ratedAt));
    if (sort === "title") return [...shown].sort((a, b) => a.title.title.localeCompare(b.title.title, locale));
    return shown;
  };

  return (
    <QueryState
      query={q}
      loading={<GridSkeleton toolbar />}
      isEmpty={(d) => d.ratings.length === 0}
      empty={
        <EmptyState
          icon={Star}
          title={t("emptyRatings")}
          about={kids ? t("emptyRatingsHintKids") : t("emptyRatingsHint")}
          action={
            <Link href="/search" className={buttonClass("primary")}>
              <Search aria-hidden />
              {t("findTitles")}
            </Link>
          }
        />
      }
      error={{ title: t("loadError") }}
    >
      {(d) => {
        const rows = order(d.ratings);
        const mixed = d.ratings.some((r) => r.title.kind === "movie") && d.ratings.some((r) => r.title.kind === "tv");
        return (
          <div>
            <CollectionToolbar
              filters={filters}
              set={set}
              types={mixed}
              sort={{
                value: sort,
                onChange: (v) => set({ sort: v === "rated" ? null : v }),
                options: [
                  { value: "rated", label: t("sortRated") },
                  { value: "high", label: t("sortHigh") },
                  { value: "low", label: t("sortLow") },
                  { value: "title", label: tb("sortTitle") },
                ],
              }}
              shown={rows.length}
              total={d.ratings.length}
            />
            {rows.length === 0 ? (
              <EmptyState
                icon={Star}
                title={t("filterEmpty")}
                action={
                  <Button variant="secondary" onClick={() => set({ show: null })}>
                    {tc("resetFilters")}
                  </Button>
                }
              />
            ) : (
              <>
                <ListGrid>
                  {rows.slice(0, limit).map((r) => (
                    <RatedCard key={r.title.id} r={r} onRemove={remove.run} onSaved={saved} label={t("removeRating")} />
                  ))}
                </ListGrid>
                <ShowMore shown={Math.min(limit, rows.length)} total={rows.length} onMore={more} />
              </>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}

/** A rated title. Memoised: "Show more" draws only the new cards, not again the ones already shown. */
const RatedCard = memo(function RatedCard({
  r,
  onRemove,
  onSaved,
  label,
}: {
  r: RatingRow;
  onRemove: (r: RatingRow) => unknown;
  onSaved: (r: RatingRow, value: number | null) => void;
  label: string;
}) {
  return (
    <PosterCard title={r.title} more={{ remove: { label, run: () => void onRemove(r) } }} moreVisibility="always">
      <RatingBadge title={r.title} value={r.value} onSaved={(v) => onSaved(r, v)} />
    </PosterCard>
  );
});
