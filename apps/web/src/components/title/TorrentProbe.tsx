"use client";

import type { SourceState } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useMediaErrorText } from "@/components/sources/media-error";
import { useSession } from "@/components/providers/Providers";
import { RESOLUTION, releaseMarks, useReleaseText } from "@/components/sources/release-text";
import { toast } from "@/components/ui/Toast";
import { useLibraryState } from "@/hooks/useLibraryState";
import { useReleasePrefs, useTorrentLookup } from "@/hooks/useTorrentLookup";
import { useRouter } from "@/i18n/navigation";
import { pickRelease } from "@/lib/media/release-pick";
import { bestOf } from "@/lib/media/releases";
import { addTorrentSource } from "@/lib/media/torrent-source";
import { background } from "@/lib/optional";
import { findsKey, reportFind, type TorrentFinds } from "@/lib/torrent-finds";
import { type TitleCore, watchHref } from "./core";
import type { TorrentState } from "./hero-plan";

export interface ProbeResult {
  state: TorrentState;
  /** "Watch" the recommended release: added to the TorrServer, then the player; false when that failed (said in a toast). */
  play?: () => Promise<boolean>;
}

/**
 * The profile's TorrServer search for the title, run by this device for the hero's main button and line (8.2: "Watch ·
 * Through TorrServer · [HD] dub Le Doyen"). The same query as "Where to watch" (hooks/useTorrentLookup), so both
 * say the same thing (TTL-06) and the search runs once; the recommendation is the one "Where to watch" shows first.
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
  const lookup = useTorrentLookup(d, source, true);
  const { data: lib } = useLibraryState(d.id);
  const prefs = useReleasePrefs();
  const ranked = lookup.data?.ranked;
  // What "Where to watch" recommends with nothing chosen: the profile's first audio option, its best release's cut,
  // the mode's picture (lib/media/release-pick, the same function).
  const { option, chosen } = useMemo(() => pickRelease(ranked ?? [], prefs), [ranked, prefs]);
  const voice = option?.studio ? option.key : null;

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
  // The resolution in words only where no mark says it: 720p (under HD), SD.
  const summary = chosen
    ? [
        chosen.info.resolution === 720 || chosen.info.resolution === 480 ? RESOLUTION[chosen.info.resolution] : null,
        text.audio({ info: chosen.info, language: option?.language ?? chosen.language }, option?.studio),
      ]
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
    const href = watchHref(d, lib?.progress);
    onChange({
      state: { state: "found", name: source.name, summary, marks },
      play: async () => {
        try {
          const added = await addTorrentSource(source.id, d, null, chosen.result);
          if (!added) throw new Error(tp("addFailed"));
          await qc.invalidateQueries({ queryKey: ["availability", d.id] });
          // The chosen dubbing goes along, so the player starts that studio's track (as "Where to watch" does).
          router.push(`${href}${href.includes("?") ? "&" : "?"}source=${source.id}:${encodeURIComponent(added.hash)}&added=1${voice ? `&voice=${encodeURIComponent(voice)}` : ""}`);
          return true;
        } catch (e) {
          toast.error(t("releaseAddFailed", { error: mediaError(e) }));
          return false;
        }
      },
    });
  }, [status, summary, chosen?.result.link, lib?.progress?.updatedAt]);

  return null;
}
