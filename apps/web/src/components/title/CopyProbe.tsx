"use client";

import type { Availability, TitleAvailability } from "@lumovio/contracts";
import { useEffect } from "react";
import { useCopyText } from "@/components/sources/copy-text";
import type { QualityMark } from "@/components/sources/QualityBadges";
import { copyAudio } from "@/lib/media/copy-audio";
import { orderedSources } from "@/lib/media/source-order";

export interface CopyFace {
  /** The copy the hero starts: the first in the profile's audio order, TorrServer copies by their release names too. */
  copy: Availability;
  marks: QualityMark[];
  heard: string | null;
}

/**
 * The hero's copy where TorrServer copies are among the title's: the first of them all in the profile's audio order as
 * "Where to watch" and the player order them (release names and files read), with its marks and what this profile hears.
 * Its own chunk, loaded only then, so the title's first load doesn't carry the release names' reading (as ./TorrentProbe
 * for the search). Draws nothing.
 */
export function CopyProbe({
  copies,
  all,
  languages,
  studios,
  originalLanguage,
  onChange,
}: {
  copies: TitleAvailability;
  all: Availability[];
  languages: readonly string[];
  studios: readonly string[];
  originalLanguage: string | null;
  onChange: (face: CopyFace) => void;
}) {
  const copyText = useCopyText();
  const copy = orderedSources(copies, undefined, languages, studios, copyAudio)[0]?.server;
  const marks = copy ? copyText.quality(copy, all, originalLanguage).marks : [];
  const heard = copy ? copyText.sound(copy, all, originalLanguage) : null;
  const key = `${copy?.connectionId}:${copy?.externalId}|${marks.join(",")}|${heard ?? ""}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: tells the hero when the copy or its words change
  useEffect(() => {
    if (copy) onChange({ copy, marks, heard });
  }, [key]);
  return null;
}
