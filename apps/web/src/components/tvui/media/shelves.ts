import type { CatalogRow, ContinueWatchingItem, Genre, RecommendationShelf } from "@lumovio/contracts";
import { genreNames, reasonLine, shelfTitle } from "@/components/media/recommendation-copy";
import { shelfHref } from "@/components/media/shelf-copy";
import { formatRuntime } from "@/lib/format";
import { trimOverview, type TvShelfData } from "./types";

/*
 * The site's shelves as TV shelves (server side): the same data and headings as the site (design-system 7.13), the
 * overviews kept for the spotlight (trimmed), the notes the cards can't show in the spotlight's line.
 */

// biome-ignore lint/suspicious/noExplicitAny: next-intl's translator of the whole catalogue, from getTranslations()
type T = (key: any, values?: any) => string;

/** Shelves shown as 16:9 artwork instead of posters, for rhythm (as the site's home does). */
const WIDE = new Set(["popular_tv", "on_air", "miniseries"]);

export function continueShelf(items: ContinueWatchingItem[], t: T, title?: string): TvShelfData | null {
  if (!items.length) return null;
  const minutes = (sec: number) => formatRuntime(Math.round(sec / 60), (k, v) => t(k, v)) ?? "";
  return {
    key: "continue",
    title: title ?? t("rows.continueWatching"),
    shape: "wide",
    items: items.map(({ title: x, progress, next }) => {
      const s = next?.season ?? progress.season;
      const e = next?.episode ?? progress.episode;
      const left = progress.durationSec ? Math.max(0, progress.durationSec - progress.positionSec) : null;
      const note = next
        ? t("card.nextEpisode", { season: next.season, episode: next.episode })
        : [
            s !== null && e !== null ? t("card.episode", { season: s, episode: e }) : null,
            left === null
              ? null
              : left < 60
                ? t("card.leftUnderMinute")
                : t("rows.timeLeft", { time: minutes(left) }),
          ]
            .filter(Boolean)
            .join(" · ");
      return {
        title: trimOverview(x),
        note,
        href: `/watch/${x.kind}/${x.tmdbId}${s !== null && e !== null ? `?s=${s}&e=${e}` : ""}`,
        label: t("tvui.continueLabel", { title: x.title, where: note }),
        progress: next ? 0 : (progress.fraction ?? 0),
      };
    }),
  };
}

export function catalogShelf(row: CatalogRow, t: T, top10 = false): TvShelfData | null {
  if (row.items.length < 3) return null;
  return {
    key: row.key,
    title: top10 ? t("rows.top10") : (row.title ?? t(row.titleKey)),
    shape: top10 ? "top10" : WIDE.has(row.key) ? "wide" : "poster",
    items: (top10 ? row.items.slice(0, 10) : row.items).map((x) => ({ title: trimOverview(x) })),
    href: top10 ? null : shelfHref(row.key, row.href),
  };
}

export function personalShelf(shelf: RecommendationShelf, t: T, genres: Genre[]): TvShelfData {
  const byId = genreNames(genres);
  const tr = (k: string, v?: Record<string, unknown>) => t(`rows.${k}`, v);
  return {
    key: shelf.key,
    title: shelfTitle(tr as never, shelf),
    shape: "poster",
    items: shelf.items.map((rec) => ({
      title: trimOverview(rec.title),
      note: reasonLine(tr as never, rec.reason, byId),
    })),
  };
}
