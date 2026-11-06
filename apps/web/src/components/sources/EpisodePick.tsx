"use client";

import type { SeasonDetails, TitleDetails } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PickItem, PickPill } from "@/components/title/WatchCard";
import { Menu, MenuCheckboxItem } from "@/components/ui/Menu";
import { useLibraryState } from "@/hooks/useLibraryState";
import { useSpoilerPrefs } from "@/hooks/useSpoilers";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { episodesOpen } from "@/lib/spoilers";

/**
 * Which episode the sources screen is for (design-system 7.15 «Экран источников»): two pills of "Where to watch" —
 * "Season 2 ⌄", "Episode 3 ⌄" — each a menu with the current one ticked; another one opens the same screen for it (its
 * copies, and the releases that hold its season first). Specials last; an unwatched episode's name only where the
 * profile shows names (8.12). `href`: the screen's address for an episode.
 */
export function EpisodePick({ details: d, season, episode, href }: { details: TitleDetails; season: number; episode: number; href: (season: number, episode: number) => string }) {
  const t = useTranslations("player");
  const tt = useTranslations("title");
  const locale = useLocale();
  const router = useRouter();
  const spoilers = useSpoilerPrefs();
  const watched = useLibraryState(d.id).data?.watchedEpisodes;
  const open = episodesOpen(watched);
  const seasons = d.seasons.filter((s) => s.episodeCount > 0).sort((a, b) => (a.seasonNumber === 0 ? 1 : b.seasonNumber === 0 ? -1 : a.seasonNumber - b.seasonNumber));
  const current = seasons.find((s) => s.seasonNumber === season);
  // The same query as the title's season browser and the player's episodes panel (usually cached).
  const names = useQuery({
    queryKey: ["season", d.tmdbId, season, locale],
    queryFn: () => api<SeasonDetails>(`/api/catalog/tv/${d.tmdbId}/season/${season}`),
    staleTime: 30 * 60_000,
  });
  const nameOf = (e: number) => (spoilers.names && !open(season, e) ? null : (names.data?.episodes.find((x) => x.episodeNumber === e)?.name ?? null));
  const seasonName = (n: number) => (n === 0 ? (seasons.find((s) => s.seasonNumber === 0)?.name ?? tt("season", { n })) : tt("season", { n }));
  const go = (s: number, e: number) => router.replace(href(s, e), { scroll: false });
  const count = current?.episodeCount ?? episode;
  return (
    <div className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {seasons.length > 1 && (
        <Menu label={t("seasonPick")} align="start" trigger={<PickPill name={t("seasonPick")} value={season === 0 ? seasonName(0) : String(season)} aria-label={tt("pickValue", { name: t("seasonPick"), value: seasonName(season) })} />}>
          {seasons.map((s) => (
            <MenuCheckboxItem key={s.seasonNumber} checked={s.seasonNumber === season} onCheckedChange={() => s.seasonNumber !== season && go(s.seasonNumber, 1)}>
              {s.seasonNumber === 0 ? seasonName(0) : t("seasonOption", { season: s.seasonNumber, count: s.episodeCount })}
            </MenuCheckboxItem>
          ))}
        </Menu>
      )}
      <Menu label={t("episodePick")} align="start" trigger={<PickPill name={t("episodePick")} value={String(episode)} aria-label={tt("pickValue", { name: t("episodePick"), value: [String(episode), nameOf(episode)].filter(Boolean).join(" · ") })} />}>
        {Array.from({ length: count }, (_, i) => i + 1).map((e) => (
          <MenuCheckboxItem key={e} checked={e === episode} onCheckedChange={() => e !== episode && go(season, e)}>
            <PickItem name={t("episodeShort", { episode: e })} sub={nameOf(e)} />
          </MenuCheckboxItem>
        ))}
      </Menu>
    </div>
  );
}
