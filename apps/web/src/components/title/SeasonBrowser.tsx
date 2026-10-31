"use client";

import type { EpisodeSummary, SeasonDetails, TitleLibraryState } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Eye, SkipForward } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState } from "react";
import { Artwork } from "@/components/media/Artwork";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { QueryState } from "@/components/ui/QueryState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spoiler } from "@/components/ui/Spoiler";
import { PillTabs, pillTabId } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { useTitleAvailability } from "@/hooks/useAvailability";
import { useLibraryState, useSetLibraryState } from "@/hooks/useLibraryState";
import { useSpoilerPrefs } from "@/hooks/useSpoilers";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import { episodesOpen } from "@/lib/spoilers";
import { useAction } from "@/lib/use-action";
import { randomId } from "@/lib/random-id";
import type { TitleCore } from "./core";
import { useHydrated } from "./hydrated";

type Ep = { season: number; episode: number };
const key = (e: Ep) => `s${e.season}e${e.episode}`;
type SpoilerPart = "still" | "name" | "overview";
/** Per part of an episode: hidden, shown on press (false), or nothing to hide (null). */
type Spoilers = Record<SpoilerPart, boolean | null>;
/** The episodes' panel, which the season pills choose for. */
const PANEL = "season-episodes";

/**
 * The "Episodes" tab (design-system 7.12 EpisodeRow, S07, C12): the seasons as a row of pills (ui/PillTabs, owner
 * 2026-10-25 — not a select), specials last, the row scrolling on a phone and opening on the profile's season with
 * "7 episodes · 2008" under it; a row per episode — the 16:9 still, its number and name, date and length, two lines
 * of overview, "Watched" (IconButton pressed: changes at once, pressing again takes it back). Marking an episode while
 * earlier ones are unwatched offers "Mark the earlier ones too" (the series' "up to this episode", 8.1). "Mark season
 * watched" / "Unmark season" say what they did with "Undo", which puts back exactly what was there — the old dates
 * included (TTL-05, TTL-25). "Next episode" goes to the first unwatched aired one. Spoilers (8.12): after the last
 * watched episode the stills and descriptions (and names, if the profile hides them) are hidden until pressed (ui/
 * Spoiler); "Show spoilers" shows them all for this visit, then "Hide spoilers" puts them back, those shown one by one too.
 */
export function SeasonBrowser({ title: d }: { title: TitleCore }) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tc = useTranslations("common");
  const ts = useTranslations("spoilers");
  const locale = useLocale();
  const { me } = useSession();
  const hydrated = useHydrated();
  const signedIn = Boolean(me?.activeProfile);
  // What the hero already fetched waits for the end of hydration (./hydrated).
  const { data: cached } = useLibraryState(d.id);
  const state = hydrated ? cached : undefined;
  const setState = useSetLibraryState();
  const avail = useTitleAvailability(d.id);
  // An episode opens the player where it can play: an own copy, or the TorrServer the sources screen searches.
  const canPlay = avail.state.kind === "playable" || Boolean(!me?.activeProfile?.isKids && avail.data?.sources.some((s) => s.kind === "torrserver"));
  const regular = d.seasons.filter((s) => s.seasonNumber > 0);
  // Specials (season 0) go last, as streaming services list them.
  const ordered = [...regular, ...d.seasons.filter((s) => s.seasonNumber === 0)];
  const [season, setSeason] = useState(regular[0]?.seasonNumber ?? d.seasons[0]?.seasonNumber ?? 1);
  const [jump, setJump] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const prefs = useSpoilerPrefs();
  const [showAll, setShowAll] = useState(false);
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    // Open on the season the profile is in.
    const s = state?.progress?.season;
    if (s !== null && s !== undefined && d.seasons.some((x) => x.seasonNumber === s)) setSeason(s);
  }, [state?.progress?.season, d.seasons]);

  const seasonQ = useQuery({
    queryKey: ["season", d.tmdbId, season, locale],
    queryFn: () => api<SeasonDetails>(`/api/catalog/tv/${d.tmdbId}/season/${season}`),
    staleTime: 30 * 60_000,
  });
  const { data } = seasonQ;
  const watchedSet = new Set(state?.watchedEpisodes ?? []);
  const today = new Date().toISOString().slice(0, 10);
  const aired = (e: EpisodeSummary) => Boolean(e.airDate && e.airDate <= today);
  // The season mark covers the aired episodes, as the server does.
  const airedEps: Ep[] = (data?.episodes ?? []).filter(aired).map((e) => ({ season: e.seasonNumber, episode: e.episodeNumber }));
  const allWatched = airedEps.length > 0 && airedEps.every((e) => watchedSet.has(key(e)));
  const open = episodesOpen(state?.watchedEpisodes);
  const spoilersOf = (e: EpisodeSummary): Spoilers => {
    const k = key({ season: e.seasonNumber, episode: e.episodeNumber });
    const closed = !open(e.seasonNumber, e.episodeNumber);
    const part = (p: SpoilerPart, on: boolean, has: unknown) => (on && closed && has ? !showAll && !shown.has(`${k}:${p}`) : null);
    return { still: part("still", prefs.stills, e.stillPath), name: part("name", prefs.names, e.name), overview: part("overview", prefs.overviews, e.overview) };
  };
  // The season's spoilers: some still hidden → "Show spoilers"; all shown → "Hide spoilers"; none → no button.
  const seasonSpoilers = data && data.seasonNumber === season ? data.episodes.flatMap((e) => Object.values(spoilersOf(e)).filter((v) => v !== null)) : [];
  const anyHidden = seasonSpoilers.some(Boolean);

  // "Next episode": the first aired, unwatched one of this season, else the next season's.
  const nextHere = (data?.episodes ?? []).find((e) => aired(e) && !watchedSet.has(key({ season: e.seasonNumber, episode: e.episodeNumber })));
  const laterSeason = regular.find((s) => s.seasonNumber > season);
  useEffect(() => {
    if (!jump || !data || data.seasonNumber !== season) return;
    setJump(false);
    const row = nextHere && list.current?.querySelector<HTMLElement>(`[data-episode="${nextHere.episodeNumber}"]`);
    if (!row) {
      toast.info(tp("allCaughtUp"));
      return;
    }
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    row.querySelector<HTMLElement>("a,button")?.focus({ preventScroll: true });
  }, [jump, data, season, nextHere, tp]);
  const goNext = () => {
    if (!nextHere && laterSeason) setSeason(laterSeason.seasonNumber);
    setJump(true);
  };

  const fresh = async () => (await api<{ states: TitleLibraryState[] }>(`/api/library/state?ids=${d.id}`)).states[0]!;
  const mark = (body: Record<string, unknown>) => api<TitleLibraryState>("/api/history/mark", { method: "POST", json: { titleId: d.id, ...body } });
  const undo = async (undoKey: string) => setState(await api<TitleLibraryState>("/api/history/mark/undo", { method: "POST", json: { undoKey } }));

  // One episode's check: it changes at once and a failure puts it back with a toast (8.3); pressing again undoes it.
  const markEpisode = useAction({
    run: async (e: Ep, watched: boolean) => {
      const s = await mark({ season: e.season, episode: e.episode, watched });
      setState(s);
      return s;
    },
    optimistic: (e, watched) => {
      const prev = state;
      if (!prev) return;
      const k = key(e);
      setState({ ...prev, watchedEpisodes: watched ? [...new Set([...prev.watchedEpisodes, k])] : prev.watchedEpisodes.filter((x) => x !== k) });
      return () => setState(prev);
    },
  });
  // "Up to this episode" and the season: exactly undone, through the key the server keeps the change under. The toast
  // counts what the server changed.
  const markMany = useAction({
    run: async (body: Record<string, unknown>, undoKey: string) => {
      const before = new Set(state?.watchedEpisodes ?? []);
      const s = await mark({ ...body, undoKey });
      setState(s);
      const after = new Set(s.watchedEpisodes);
      const count = body.watched ? [...after].filter((k) => !before.has(k)).length : [...before].filter((k) => !after.has(k)).length;
      return { state: s, count };
    },
    optimistic: (body) => {
      const prev = state;
      if (!prev) return;
      // The season's own episodes change on screen at once; "up to" waits for the server's answer.
      if (body.scope === "season" && body.season === season) {
        const keys = new Set(airedEps.map(key));
        setState({ ...prev, watchedEpisodes: body.watched ? [...new Set([...prev.watchedEpisodes, ...keys])] : prev.watchedEpisodes.filter((k) => !keys.has(k)) });
      }
      return () => setState(prev);
    },
    success: (r, body) =>
      r.count === 0 ? null : body.scope === "until" ? tp("earlierMarked", { count: r.count }) : body.watched ? t("seasonMarked", { count: r.count }) : t("seasonUnmarked", { count: r.count }),
    undo: (_r, _body, undoKey) => undo(undoKey),
    sync: () => void fresh().then(setState, () => undefined),
  });

  const toggle = async (e: EpisodeSummary, watched: boolean) => {
    const r = await markEpisode.run({ season: e.seasonNumber, episode: e.episodeNumber }, watched);
    if (!r.ok || !watched || e.seasonNumber === 0) return;
    // Earlier aired episodes still unwatched (this season's, or a whole earlier season's): offer to mark them too, once.
    const marked = new Set(r.value.watchedEpisodes);
    const earlierHere = (data?.episodes ?? []).some((x) => aired(x) && x.episodeNumber < e.episodeNumber && !marked.has(key({ season: x.seasonNumber, episode: x.episodeNumber })));
    const seen = (sn: number) => [...marked].filter((k) => k.startsWith(`s${sn}e`)).length;
    const earlierSeasons = regular.some((s) => s.seasonNumber < e.seasonNumber && seen(s.seasonNumber) < s.episodeCount);
    if (!earlierHere && !earlierSeasons) return;
    toast.info(tp("episodeMarked", { episode: e.episodeNumber }), {
      action: { label: tp("markEarlier"), onClick: () => void markMany.run({ scope: "until", season: e.seasonNumber, episode: e.episodeNumber, watched: true }, randomId()) },
    });
  };

  // Long-running shows have dozens of seasons: the row scrolls and opens on the chosen one (ui/PillTabs).
  const tabs = ordered.map((s) => ({ value: String(s.seasonNumber), label: s.seasonNumber === 0 ? t("specials") : t("seasonPill", { n: s.seasonNumber }) }));
  const current = d.seasons.find((s) => s.seasonNumber === season);
  const facts = current ? [tc("episodes", { count: current.episodeCount }), current.airDate?.slice(0, 4)].filter(Boolean).join(" · ") : null;
  return (
    <section aria-labelledby="seasons-h">
      <h2 id="seasons-h" className="sr-only">
        {t("episodesTitle")}
      </h2>
      {/* A series of one season has nothing to choose: its facts and actions only. */}
      {tabs.length > 1 && <PillTabs tabs={tabs} value={String(season)} onValueChange={(v) => setSeason(Number(v))} label={t("seasons")} panelId={PANEL} className="mb-3" />}
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        {facts && <p className="text-body-s text-text-2 tabular-nums in-data-[tv=1]:text-body">{facts}</p>}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 sm:ms-auto">
          {signedIn && watchedSet.size > 0 && (
            <Button variant="tertiary" size="sm" icon={SkipForward} onClick={goNext}>
              {tp("nextUnwatched")}
            </Button>
          )}
          {seasonSpoilers.length > 0 && (
            <Button
              variant="tertiary"
              size="sm"
              icon={Eye}
              onClick={() => {
                setShowAll(anyHidden);
                if (!anyHidden) setShown(new Set());
              }}
            >
              {anyHidden ? ts("showAll") : ts("hideAll")}
            </Button>
          )}
          {signedIn && data && airedEps.length > 0 && (
            <Button
              variant="tertiary"
              size="sm"
              icon={CircleCheck}
              loading={markMany.pending}
              onClick={() => void markMany.run({ scope: "season", season, watched: !allWatched }, randomId())}
            >
              {allWatched ? t("unmarkSeason") : t("markSeason")}
            </Button>
          )}
        </div>
      </div>
      <div id={PANEL} role="tabpanel" aria-labelledby={tabs.length > 1 ? pillTabId(PANEL, String(season)) : "seasons-h"}>
        <QueryState
        query={seasonQ}
        loading={
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4 py-2">
                <Skeleton className="aspect-video w-36 shrink-0 sm:w-48 md:w-56" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton shape="xs" className="h-4 w-1/2" />
                  <Skeleton shape="xs" className="h-3 w-full" />
                  <Skeleton shape="xs" className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        {(data) => (
          <ol ref={list} className="flex flex-col gap-1">
            {data.episodes.map((e) => (
              <EpisodeRow
                key={e.id}
                episode={e}
                titleId={d.id}
                tmdbId={d.tmdbId}
                aired={aired(e)}
                watched={watchedSet.has(key({ season: e.seasonNumber, episode: e.episodeNumber }))}
                progress={state?.progress && !state.progress.completed && state.progress.season === e.seasonNumber && state.progress.episode === e.episodeNumber ? state.progress.fraction : null}
                canPlay={canPlay}
                signedIn={signedIn}
                locale={locale}
                spoilers={spoilersOf(e)}
                onShow={(part) => setShown((s) => new Set(s).add(`${key({ season: e.seasonNumber, episode: e.episodeNumber })}:${part}`))}
                onToggle={(w) => void toggle(e, w)}
              />
            ))}
          </ol>
        )}
        </QueryState>
      </div>
    </section>
  );
}

/**
 * One episode (7.12 EpisodeRow): the still, "4 episode · 17 Feb 2008 · 49 min", the name, two lines, "Watched". A part
 * that could spoil the plot is a Spoiler (7.21) — the still, the name, the description each shown by its own press.
 */
function EpisodeRow({
  episode: e,
  tmdbId,
  aired,
  watched,
  progress,
  canPlay,
  signedIn,
  locale,
  spoilers,
  onShow,
  onToggle,
}: {
  episode: EpisodeSummary;
  titleId: string;
  tmdbId: number;
  aired: boolean;
  watched: boolean;
  progress: number | null;
  canPlay: boolean;
  signedIn: boolean;
  locale: string;
  spoilers: Spoilers;
  onShow: (part: SpoilerPart) => void;
  onToggle: (watched: boolean) => void;
}) {
  const t = useTranslations("title");
  const tp = useTranslations("titlePage");
  const tc = useTranslations("common");
  const tk = useTranslations("card");
  const ts = useTranslations("spoilers");
  const frame = (
    <Artwork shape="landscape" src={tmdbImage(e.stillPath, "w300")} placeholder="tv" progress={progress} blurred={spoilers.still === true} className={cn(!aired && "opacity-60")} />
  );
  const label = e.seasonNumber === 0 ? tp("specialNumber", { n: e.episodeNumber }) : tp("episodeNumber", { n: e.episodeNumber });
  const name = <h3 className="mt-0.5 line-clamp-2 text-title text-text-1">{e.name}</h3>;
  const overview = e.overview && <p className="line-clamp-2 text-body-s text-text-2">{e.overview}</p>;
  return (
    <li data-episode={e.episodeNumber} className="group/card flex gap-3 rounded-md p-2 transition-colors duration-fast ease-fast hover:bg-surface-1 sm:gap-4 md:p-3">
      <Spoiler variant="image" hidden={spoilers.still === true} onReveal={() => onShow("still")} label={ts("showStill", { episode: label })} className="w-36 shrink-0 self-start sm:w-48 md:w-56">
        {aired && canPlay ? (
          <Link
            href={`/watch/tv/${tmdbId}?s=${e.seasonNumber}&e=${e.episodeNumber}`}
            className="group/link block rounded-sm focus-visible:outline-none"
            aria-label={[tp("playEpisode", { episode: tk("episode", { season: e.seasonNumber, episode: e.episodeNumber }) }), spoilers.name ? null : e.name].filter(Boolean).join(" — ")}
          >
            {frame}
          </Link>
        ) : (
          frame
        )}
      </Spoiler>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-body-s text-text-2 tabular-nums">
              {[label, e.airDate ? (aired ? formatDate(e.airDate, locale) : t("airs", { date: formatDate(e.airDate, locale) ?? "" })) : null, e.runtime ? tc("minutes", { count: e.runtime }) : null]
                .filter((x): x is string => Boolean(x))
                // Each fact whole ("59 мин", "29 сент. 2023 г." have plain spaces) and the "·" kept with the fact before it.
                .map((x, i) => (
                  <Fragment key={x}>
                    {i > 0 && <>&nbsp;· </>}
                    <span className="whitespace-nowrap">{x}</span>
                  </Fragment>
                ))}
            </p>
            {spoilers.name === null ? (
              name
            ) : (
              <Spoiler hidden={spoilers.name} onReveal={() => onShow("name")} label={ts("showName", { episode: label })}>
                {name}
              </Spoiler>
            )}
          </div>
          {signedIn && aired && <IconButton icon={CircleCheck} label={tk("watched")} pressed={watched} variant="ghost" size="md" className="-me-1 -mt-1" onClick={() => onToggle(!watched)} />}
        </div>
        {overview &&
          (spoilers.overview === null ? (
            <div className="mt-1">{overview}</div>
          ) : (
            <Spoiler hidden={spoilers.overview} onReveal={() => onShow("overview")} label={ts("showOverview", { episode: label })} className="mt-1">
              {overview}
            </Spoiler>
          ))}
        {!aired && <p className="mt-1 text-body-s text-text-2">{t("notAired")}</p>}
      </div>
    </li>
  );
}
