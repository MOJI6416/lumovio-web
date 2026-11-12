"use client";

import type { SourceState } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { endLaunch, startLaunch } from "@/components/player/launch";
import { useMediaErrorText } from "@/components/sources/media-error";
import { useSession } from "@/components/providers/Providers";
import { RESOLUTION, releaseMarks, useReleaseText } from "@/components/sources/release-text";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { useTitleAvailability } from "@/hooks/useAvailability";
import { useLibraryState } from "@/hooks/useLibraryState";
import { useReleasePrefs, useTorrentLookup } from "@/hooks/useTorrentLookup";
import { useRouter } from "@/i18n/navigation";
import { pickAlternatives, pickRelease } from "@/lib/media/release-pick";
import { sharedFileOf } from "@/lib/media/release-files";
import { bestOf, copyFileTracks, voiceWish, wishNameTrack } from "@/lib/media/releases";
import { addFirstWorking, takeBack } from "@/lib/media/torrent-source";
import { background } from "@/lib/optional";
import { findsKey, reportFind, type TorrentFinds } from "@/lib/torrent-finds";
import { useChosenSeason } from "./chosen-season";
import { sourcesHref, startEpisode, type TitleCore, watchHref } from "./core";
import type { TorrentState } from "./hero-plan";

export interface ProbeResult {
  state: TorrentState;
  /** "Watch" the recommended release: added to the TorrServer, then the player; false when that failed (said in a toast). */
  play?: () => Promise<boolean>;
}

/**
 * The profile's TorrServer search for the title, run by this device for the hero's main button and line ("Watch ·
 * Through TorrServer · [HD] dub Le Doyen"). The same query as "Where to watch" (hooks/useTorrentLookup), so both
 * say the same thing and the search runs once; the recommendation is the one "Where to watch" shows first.
 * Loaded only where such a search runs. Draws nothing.
 */
export function TorrentProbe({ title: d, source, onChange }: { title: TitleCore; source: SourceState; onChange: (r: ProbeResult) => void }) {
  const t = useTranslations("titlePage");
  const tp = useTranslations("player");
  const mediaError = useMediaErrorText();
  const { me } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const text = useReleaseText();
  const { data: lib } = useLibraryState(d.id);
  // The episode "Watch" opens (resume, else the next), as "Where to watch" ranks for it: the release has to hold it.
  const season = useChosenSeason(d.id);
  const start = d.kind === "tv" ? startEpisode(d, lib?.progress, season) : null;
  const lookup = useTorrentLookup(d, source, true, undefined, start?.season ?? null, start?.episode ?? null);
  const prefs = useReleasePrefs();
  const ranked = lookup.data?.ranked;
  // What "Where to watch" recommends with nothing chosen: the profile's first audio option, its best release's cut,
  // the mode's picture (lib/media/release-pick, the same function).
  const pick = useMemo(() => pickRelease(ranked ?? [], prefs), [ranked, prefs]);
  const { option, chosen } = pick;
  // A studio's option or a language's alone ("Ukrainian · MVO"): the player starts that track, not the file's default.
  const voice = option && (option.studio || option.language) ? option.key : null;

  // What the releases' files hold, read ahead through the server when the page is idle (lib/media/read-ahead): the
  // pick then knows the studios a name like "6x MVO" hides. It reads the ranking as it is after every read.
  const avail = useTitleAvailability(d.id);
  const copies = useMemo(() => copyFileTracks(avail.data?.servers ?? []), [avail.data]);
  const now = useRef({ ranked, prefs, copies });
  now.current = { ranked, prefs, copies };
  // biome-ignore lint/correctness/useExhaustiveDependencies: one round per search answer and episode
  useEffect(() => {
    if (!lookup.data) return;
    let cancel: (() => void) | null = null;
    let gone = false;
    void import("@/lib/media/read-ahead").then((m) => {
      if (gone) return;
      cancel = m.readAhead(
        { connectionId: source.id, titleId: d.id, movie: d.kind === "movie", year: d.year ?? null, season: start?.season ?? null, episode: start?.episode ?? null },
        () => (now.current.ranked ? { ranked: now.current.ranked, prefs: now.current.prefs, known: (r) => sharedFileOf(r) != null || Boolean(now.current.copies?.(r)) } : null),
        () => undefined,
      );
    });
    return () => {
      gone = true;
      cancel?.();
    };
  }, [lookup.data?.at, source.id, d.id, start?.season, start?.episode]);

  // A search for a watchlist title counts for the profile's other devices too (and spares them one for 12 hours).
  const profileId = me?.activeProfile?.id ?? null;
  const inWatchlist = Boolean(lib?.inWatchlist);
  // biome-ignore lint/correctness/useExhaustiveDependencies: report once per search result
  useEffect(() => {
    if (!lookup.data || !inWatchlist || !profileId) return;
    background(
      reportFind(d.id, bestOf(lookup.data.ranked), lookup.data.ranked).then((f) =>
        qc.setQueryData<{ finds: TorrentFinds }>(findsKey(profileId), (old) => (old ? { finds: { ...old.finds, [d.id]: f } } : old)),
      ),
    );
  }, [lookup.data?.at, inWatchlist]);

  // The release's marks (4K, Dolby Vision — QualityBadges) and the rest in words: what they don't say ("720p"), what is heard.
  const marks = chosen ? releaseMarks(chosen.info) : [];
  // The resolution in words where no mark says it: 1080p and 720p (HD is both), SD.
  const heard = chosen
    ? text.audio({ info: chosen.info, language: option?.language ?? chosen.language }, option?.studio ?? wishNameTrack(chosen.info, voiceWish(option?.key ?? null), prefs.studios))
    : "";
  const summary = chosen
    ? [chosen.info.resolution && chosen.info.resolution !== 2160 ? RESOLUTION[chosen.info.resolution] : null, heard]
        .filter(Boolean)
        .join(" · ")
    : "";
  const status = lookup.isError ? "failed" : lookup.isLoading || !lookup.data ? "searching" : chosen ? "found" : "nothing";

  // biome-ignore lint/correctness/useExhaustiveDependencies: tells the hero when the answer changes
  useEffect(() => {
    if (status !== "found" || !chosen) {
      onChange({ state: { state: status, name: source.name } as TorrentState });
      return;
    }
    const href = watchHref(d, lib?.progress, season);
    onChange({
      state: { state: "found", name: source.name, summary, marks },
      play: async () => {
        // The launch's scene from the press, the add its first step and the release under it, as "Where to watch" and the
        // sources screen start it; "Another source" drops the add for the sources screen.
        let dropped = false;
        startLaunch(
          {
            status: tp("stage_add"),
            detail: `${[text.picture(chosen.info), heard].filter(Boolean).join(" · ")} — ${source.name}`,
            onBack: () => {
              dropped = true;
              endLaunch();
            },
            actions: (
              <Button
                variant="secondary"
                onClick={() => {
                  dropped = true;
                  router.push(sourcesHref(href, voice ? `&voice=${encodeURIComponent(voice)}` : ""));
                }}
              >
                {tp("anotherSource")}
              </Button>
            ),
          },
          true,
        );
        try {
          // The next releases of the same audio and picture, when this one's tracker gives the server no torrent.
          const added = await addFirstWorking(source.id, d, start?.season ?? null, [chosen.result, ...pickAlternatives(pick).map((a) => a.result)]);
          if (!added) throw new Error(tp("addFailed"));
          await qc.invalidateQueries({ queryKey: ["availability", d.id] });
          if (dropped) {
            // Left before it played ("←" during the add): a torrent this add brought is taken back, never one that was there.
            if (!added.existed) background(takeBack(source.id, added.hash).then(() => qc.invalidateQueries({ queryKey: ["availability", d.id] })));
            return false;
          }
          // The chosen dubbing goes along, so the player starts that studio's track (as "Where to watch" does).
          router.push(`${href}${href.includes("?") ? "&" : "?"}source=${source.id}:${encodeURIComponent(added.hash)}&added=1${added.existed ? "" : "&brought=1"}${voice ? `&voice=${encodeURIComponent(voice)}` : ""}`);
          return true;
        } catch (e) {
          if (dropped) return false;
          endLaunch();
          toast.error(t("releaseAddFailed", { error: mediaError(e) }));
          return false;
        }
      },
    });
  }, [status, summary, chosen?.result.link, lib?.progress?.updatedAt, season]);

  return null;
}
