"use client";

import type { EpisodeSummary, SeasonDetails } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, EyeOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { TitleCore } from "@/components/title/core";
import { cn } from "@/components/ui/cn";
import { TvButton } from "@/components/ui/tv/TvButton";
import { useLibraryState } from "@/hooks/useLibraryState";
import { useSpoilerPrefs } from "@/hooks/useSpoilers";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import { episodesOpen } from "@/lib/spoilers";
import { TvArt } from "../media/TvCard";

const key = (s: number, e: number) => `s${s}e${e}`;

/*
 * A series' seasons and episodes on a TV (S07 TV; TV document §4 "сезоны и серии", §6): the seasons as one row of pills
 * — the episodes follow the focused season once it rests there —, then the season's episodes as one row of stills,
 * OK plays that very episode (`?s=&e=`, never the first one in its place, T1/T2), the one in progress with its bar,
 * watched ones marked. Under the row the focused episode: number, date, length, name and description; what could spoil
 * the plot stays hidden after the last watched episode (8.12), as the profile set it.
 */
export function Episodes({ title: d, zoneDown }: { title: TitleCore; zoneDown?: string }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tc = useTranslations("common");
  const tk = useTranslations("card");
  const tv = useTranslations("tvui");
  const locale = useLocale();
  const { data: state } = useLibraryState(d.id);
  const prefs = useSpoilerPrefs();
  const regular = d.seasons.filter((s) => s.seasonNumber > 0);
  const ordered = [...regular, ...d.seasons.filter((s) => s.seasonNumber === 0)];
  const [season, setSeason] = useState(regular[0]?.seasonNumber ?? d.seasons[0]?.seasonNumber ?? 1);
  const [focused, setFocused] = useState<EpisodeSummary | null>(null);
  const pending = useRef<number | null>(null);
  const opened = useRef(false);

  // Open on the season the profile is in.
  useEffect(() => {
    const s = state?.progress?.season;
    if (!opened.current && s !== null && s !== undefined && d.seasons.some((x) => x.seasonNumber === s)) {
      opened.current = true;
      setSeason(s);
    }
  }, [state?.progress?.season, d.seasons]);

  const q = useQuery({
    queryKey: ["season", d.tmdbId, season, locale],
    queryFn: () => api<SeasonDetails>(`/api/catalog/tv/${d.tmdbId}/season/${season}`),
    staleTime: 30 * 60_000,
    // The row keeps the season it shows until the next one arrives: it is never empty under the remote (TV2).
    placeholderData: (prev) => prev,
  });
  const episodes = q.data?.episodes ?? [];
  const watched = new Set(state?.watchedEpisodes ?? []);
  const open = episodesOpen(state?.watchedEpisodes);
  const today = new Date().toISOString().slice(0, 10);
  const p = state?.progress;

  // The season follows the focus once it rests on a pill (no request per pill passed on the way).
  const onSeasonFocus = (n: number) => {
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => setSeason(n), 350);
  };
  useEffect(() => () => void (pending.current && window.clearTimeout(pending.current)), []);

  const label = (e: EpisodeSummary) =>
    e.seasonNumber === 0
      ? tp("specialNumber", { n: e.episodeNumber })
      : tp("episodeNumber", { n: e.episodeNumber });
  const shown = focused && focused.seasonNumber === season ? focused : (episodes[0] ?? null);
  const closed = shown ? !open(shown.seasonNumber, shown.episodeNumber) : false;
  const facts = shown
    ? [
        label(shown),
        shown.airDate
          ? shown.airDate <= today
            ? formatDate(shown.airDate, locale)
            : t("airs", { date: formatDate(shown.airDate, locale) ?? "" })
          : null,
        shown.runtime ? tc("minutes", { count: shown.runtime }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <section data-zone-frame aria-label={t("episodesTitle")} className="flex flex-col gap-4">
      <h2 className="ps-(--tv-pad) text-h3 text-text-1">{t("episodesTitle")}</h2>
      {ordered.length > 1 && (
        <div
          data-zone="seasons"
          data-zone-scroll="x"
          data-zone-entry="current"
          data-zone-down="episodes"
          className="-my-3 overflow-hidden py-3"
        >
          <div data-zone-track className="flex w-max gap-3 ps-(--tv-pad) pe-(--gutter)">
            {ordered.map((s) => (
              <TvButton
                key={s.seasonNumber}
                data-key={String(s.seasonNumber)}
                aria-pressed={s.seasonNumber === season}
                className={cn("rounded-full", s.seasonNumber === season && "bg-selected-bg text-selected-fg")}
                onFocus={() => onSeasonFocus(s.seasonNumber)}
                onClick={() => setSeason(s.seasonNumber)}
              >
                {s.seasonNumber === 0 ? t("specials") : t("seasonPill", { n: s.seasonNumber })}
              </TvButton>
            ))}
          </div>
        </div>
      )}
      <div
        data-zone="episodes"
        data-zone-scroll="x"
        data-zone-up={ordered.length > 1 ? "seasons" : undefined}
        data-zone-down={zoneDown}
        className="-my-3 overflow-hidden py-3"
      >
        <div data-zone-track className="flex min-h-40 w-max gap-6 ps-(--tv-pad) pe-(--gutter)">
          {q.isPending &&
            Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                aria-hidden
                className="aspect-video w-72 shrink-0 animate-pulse rounded-sm bg-surface-2"
              />
            ))}
          {q.isError && (
            <TvButton data-key="retry" onClick={() => void q.refetch()}>
              {tc("retry")}
            </TvButton>
          )}
          {episodes.map((e) => {
            const k = key(e.seasonNumber, e.episodeNumber);
            const aired = Boolean(e.airDate && e.airDate <= today);
            const hide = !open(e.seasonNumber, e.episodeNumber);
            const progress =
              p && !p.completed && p.season === e.seasonNumber && p.episode === e.episodeNumber
                ? p.fraction
                : null;
            const name = prefs.names && hide ? label(e) : `${label(e)} — ${e.name}`;
            const card = (
              <>
                <TvArt
                  src={tmdbImage(e.stillPath, "w300")}
                  kind="tv"
                  className={cn(prefs.stills && hide && "scale-110 blur-lg", !aired && "opacity-50")}
                />
                <span className="stage absolute inset-x-0 bottom-0 bg-linear-to-t from-stage/90 to-transparent px-4 pt-8 pb-3 text-start text-title text-text-1">
                  <span className="line-clamp-1">
                    {prefs.names && hide ? label(e) : `${e.episodeNumber}. ${e.name}`}
                  </span>
                </span>
                {watched.has(k) && (
                  <span className="stage absolute end-2 top-2 grid size-9 place-items-center rounded-full bg-stage/80 text-text-1">
                    <CircleCheck
                      aria-label={tk("watched")}
                      className="size-6 fill-current [&>path:last-child]:text-stage"
                    />
                  </span>
                )}
                {progress !== null && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 bottom-2 h-1.5 overflow-hidden rounded-full bg-text-1/30"
                  >
                    <span
                      className="block h-full rounded-full bg-progress"
                      style={{ width: `${Math.round(Math.max(0.03, progress ?? 0) * 100)}%` }}
                    />
                  </span>
                )}
              </>
            );
            const cls =
              "tv-focus relative block aspect-video w-72 shrink-0 overflow-hidden rounded-sm bg-surface-2";
            return aired ? (
              <Link
                prefetch={false}
                key={k}
                href={`/watch/tv/${d.tmdbId}?s=${e.seasonNumber}&e=${e.episodeNumber}`}
                data-key={k}
                aria-label={tp("playEpisode", { episode: name })}
                onFocus={() => setFocused(e)}
                className={cls}
              >
                {card}
              </Link>
            ) : (
              // Not out yet: a stop of the remote (the row stays whole) that says when it airs.
              <span
                key={k}
                tabIndex={0}
                data-key={k}
                aria-label={`${name} — ${t("notAired")}`}
                onFocus={() => setFocused(e)}
                className={cls}
              >
                {card}
              </span>
            );
          })}
        </div>
      </div>
      {/* The focused episode, in a place of fixed height: arriving data doesn't move what is under it. */}
      {(shown || q.isPending) && (
        <div className="flex h-36 max-w-240 flex-col gap-2 overflow-hidden ps-(--tv-pad)" aria-live="polite">
          <p className="text-body-l text-text-2 tabular-nums">{facts}</p>
          <p className="text-title text-text-1">
            {shown && (prefs.names && closed ? tv("hiddenName") : shown.name)}
          </p>
          {shown?.overview && (
            <p className="line-clamp-2 text-body-l text-text-2">
              {prefs.overviews && closed ? (
                <span className="inline-flex items-center gap-2">
                  <EyeOff aria-hidden className="size-5" />
                  {tv("hiddenOverview")}
                </span>
              ) : (
                shown.overview
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
