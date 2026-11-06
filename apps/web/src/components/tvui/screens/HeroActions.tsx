"use client";

import type { Genre, TitleSummary } from "@lumovio/contracts";
import { Bookmark, BookmarkCheck, Info, LayoutGrid, Tags } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { usePersonalActions } from "@/components/media/usePersonalActions";
import { TvButton, tvButtonClass } from "@/components/ui/tv/TvButton";
import { Link } from "@/i18n/navigation";
import { titleHref } from "@/lib/slug";
import { TvLayer } from "../nav/TvLayer";
import { TvScroll } from "../nav/TvScroll";
import { useTvNav } from "../nav/TvNav";

/*
 * The featured title's actions on a TV screen of shelves (design-system 8.1, 8.2 on a TV): "More info" first — where
 * the screen starts, the title page decides what plays —, the labelled "Watchlist"; a section adds its whole list and
 * its genres. One zone, ← → between them.
 */
export function HeroActions({
  title,
  all,
  genres,
  genreBase,
}: {
  title: TitleSummary;
  /** The section's whole list: its label and address. */
  all?: { label: string; href: string };
  genres?: Genre[];
  /** The section whose grid a genre opens (`?view=all&genres=<id>`). */
  genreBase?: string;
}) {
  const t = useTranslations("titlePage");
  const tv = useTranslations("tvui");
  const tb = useTranslations("browse");
  const actions = usePersonalActions(title);
  const [picking, setPicking] = useState(false);
  const nav = useTvNav();
  const locale = useLocale();
  const on = actions.inWatchlist;
  return (
    <div data-zone="hero" data-zone-axis="x" data-zone-down="shelf:0" className="flex flex-wrap gap-4 pt-2">
      <Link
        prefetch={false}
        href={titleHref(title.kind, title.tmdbId, title.title)}
        data-tv-initial
        className={tvButtonClass()}
      >
        <Info aria-hidden />
        {tv("moreInfo")}
      </Link>
      <TvButton
        icon={on ? BookmarkCheck : Bookmark}
        aria-pressed={on}
        loading={actions.busy === "wl"}
        onClick={() => void actions.setWatchlist(!on)}
      >
        {t("watchlist")}
      </TvButton>
      {all && (
        <Link prefetch={false} href={all.href} className={tvButtonClass()}>
          <LayoutGrid aria-hidden />
          {all.label}
        </Link>
      )}
      {genres && genres.length > 0 && genreBase && (
        <TvButton icon={Tags} onClick={() => setPicking(true)} aria-haspopup="dialog">
          {tb("genres")}
        </TvButton>
      )}
      {picking && genres && genreBase && (
        <TvLayer label={tb("genres")} onClose={() => setPicking(false)}>
          {() => (
            <>
              <h2 className="text-h2 text-text-1">{tb("genres")}</h2>
              <TvScroll contentClassName="p-2">
                <div data-zone="genres" data-zone-axis="grid" className="grid grid-cols-2 gap-3">
                  {genres.map((g) => (
                    <TvButton
                      key={g.id}
                      look="row"
                      data-key={String(g.id)}
                      onClick={() => nav.navigate(`${genreBase}?view=all&genres=${g.id}`)}
                    >
                      {g.name.charAt(0).toLocaleUpperCase(locale) + g.name.slice(1)}
                    </TvButton>
                  ))}
                </div>
              </TvScroll>
            </>
          )}
        </TvLayer>
      )}
    </div>
  );
}
