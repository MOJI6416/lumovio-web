"use client";

import type { ListDetails, SourceState, TorrentFindBest } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useSession } from "@/components/providers/Providers";
import { QualityLine } from "@/components/sources/QualityBadges";
import { usePlayable } from "@/hooks/useAvailability";
import { autoSearchSource, isOut, type LookupResult, lookupKey, useReleasePrefs } from "@/hooks/useTorrentLookup";
import { api } from "@/lib/api";
import { namesNumbering, reportNumbering } from "@/lib/media/numbering-evidence";
import { bestOf, rankReleases, torrentQuery } from "@/lib/media/releases";
import { torrServerFor } from "@/lib/media/torrent-source";
import { keepThroughEmpty } from "@/lib/media/torrserver";
import { optional } from "@/lib/optional";
import { dropLocalFinds, fetchFinds, findMarks, findPictureText, findsKey, RECHECK_MS, reportFind, type TorrentFinds } from "@/lib/torrent-finds";
import { PosterCard } from "./PosterCard";
import { Row } from "./Row";

/** Watchlist titles searched per visit to the home page, one after another. */
const PER_VISIT = 4;
/**
 * Titles this device searched in the background lately (A6): a failed or empty search, which reports nothing, waits
 * as long as a found one before it is tried again — a broken indexer no longer means a full search on every visit.
 */
const TRIED_KEY = "lumovio.finds.tried";
const PAUSE_MS = 3 * 3600_000;
function triedLately(): Record<string, number> {
  try {
    const all = JSON.parse(localStorage.getItem(TRIED_KEY) ?? "{}") as Record<string, number>;
    return Object.fromEntries(Object.entries(all).filter(([, at]) => Date.now() - at < PAUSE_MS));
  } catch {
    return {};
  }
}
function markTried(id: string): void {
  try {
    localStorage.setItem(TRIED_KEY, JSON.stringify({ ...triedLately(), [id]: Date.now() }));
  } catch {
    // Without storage the stored finds alone decide.
  }
}

/**
 * "From your lists — on your TorrServer": watchlist titles without a copy on the profile's servers
 * for which one of its devices found a release in one of its audio languages. While the home page is
 * open, a device that may search does a few titles no device searched in the last 12 hours, through
 * the profile's own TorrServer, and reports what it found to Lumovio, so every device shows the same
 * shelf. Newest finds first.
 */
export function TorrentFindsRow() {
  const t = useTranslations("rows");
  const tt = useTranslations("title");
  const locale = useLocale();
  const { me } = useSession();
  const profile = me?.activeProfile ?? null;
  const prefs = useReleasePrefs();
  const sources = useQuery({
    queryKey: ["availability-sources", profile?.id ?? null],
    queryFn: () => api<{ sources: SourceState[] }>("/api/availability/sources"),
    enabled: profile !== null && !profile.isKids,
  });
  const source = autoSearchSource(sources.data?.sources, Boolean(profile?.isKids));
  // Finds are worth showing wherever the profile can play from a TorrServer, searching or not.
  const torrServer = Boolean(sources.data?.sources.some((s) => s.kind === "torrserver"));
  const watchlist = useQuery({
    queryKey: ["watchlist-items", profile?.id ?? null],
    queryFn: () => api<ListDetails>("/api/library/watchlist"),
    enabled: torrServer,
  });
  const titles = useMemo(() => (watchlist.data?.items ?? []).map((i) => i.title).filter(isOut), [watchlist.data]);
  const playable = usePlayable(titles.map((x) => x.id));
  const qc = useQueryClient();
  const stored = useQuery({ queryKey: findsKey(profile?.id ?? null), queryFn: fetchFinds, enabled: torrServer });
  const finds: TorrentFinds = stored.data?.finds ?? {};
  useEffect(() => {
    if (profile) dropLocalFinds(profile.id);
  }, [profile]);

  // A few searches per visit, only for titles without a copy that no device searched lately. It runs
  // again when the stored finds first arrive, not on every report it makes itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stored.isSuccess stands for the first load
  useEffect(() => {
    const known = stored.data?.finds;
    if (!profile || !source || !known || !playable.data || document.visibilityState === "hidden") return;
    const tried = triedLately();
    const due = titles.filter((x) => !playable.data[x.id] && !tried[x.id] && Date.now() - Date.parse(known[x.id]?.checkedAt ?? "1970-01-01") > RECHECK_MS).slice(0, PER_VISIT);
    if (due.length === 0) return;
    const ctrl = new AbortController();
    // A search in the background for the next visit's shelf: a server that doesn't answer, a failed search or report
    // only leaves that title for another time — nobody waits for it here.
    void (async () => {
      const ts = await optional(torrServerFor(source.id), null);
      for (const x of due) {
        if (!ts || ctrl.signal.aborted) return;
        markTried(x.id);
        const found = await optional(ts.search(torrentQuery(x), ctrl.signal), null);
        if (!found || ctrl.signal.aborted) continue;
        if (x.kind === "tv") reportNumbering(x.id, "names", namesNumbering(found.results, x));
        // The title page and its sources screen show this search instead of running their own. An empty
        // answer after results (failing indexers) keeps those and reports nothing new.
        const key = lookupKey(profile.id, source.id, x.id);
        const kept = keepThroughEmpty(qc.getQueryData<LookupResult>(key), { ...found, at: Date.now() });
        qc.setQueryData(key, kept);
        if (kept.emptyAt) continue;
        const ranked = rankReleases(found.results, x, prefs);
        const f = await optional(reportFind(x.id, bestOf(ranked), ranked), null);
        if (f) qc.setQueryData<{ finds: TorrentFinds }>(findsKey(profile.id), (old) => ({ finds: { ...old?.finds, [x.id]: f } }));
      }
    })();
    return () => ctrl.abort();
  }, [profile, source, titles, playable.data, prefs, stored.isSuccess]);

  const shown = titles
    .filter((x) => !playable.data?.[x.id] && finds[x.id]?.best?.language)
    .sort((a, b) => (finds[b.id]!.firstSeen ?? "").localeCompare(finds[a.id]!.firstSeen ?? ""));
  if (!torrServer || shown.length === 0) return null;
  const names = new Intl.DisplayNames([locale], { type: "language" });
  const audio = (b: TorrentFindBest) => [prefs.languages.length > 1 && b.language ? names.of(b.language) : null, b.studio ?? (b.voice ? tt(`voice_${b.voice}`) : null)];
  // Said in full: every picture version it was found in (TS5): "Dub · 1080p, 4K HDR".
  const badge = (b: TorrentFindBest) => [...audio(b), findPictureText(b)].filter(Boolean).join(" · ");
  // Shown: what is heard, then its best version as marks (QualityBadges, 7.15): "Dub [4K] [HDR]".
  const shownFact = (b: TorrentFindBest) => {
    const marks = findMarks(b);
    return marks.length ? <QualityLine marks={marks} words={[audio(b).filter(Boolean).join(" · ")]} /> : undefined;
  };
  return (
    <Row id="torrent_finds" min={3} title={t("torrentFinds")} note={t("torrentFindsNote")}>
      {shown.map((x) => (
        <PosterCard key={x.id} title={x} fact={badge(finds[x.id]!.best!) || undefined} factShown={shownFact(finds[x.id]!.best!)} />
      ))}
    </Row>
  );
}
