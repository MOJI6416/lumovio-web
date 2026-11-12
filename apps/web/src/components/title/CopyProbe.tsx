"use client";

import type { Availability } from "@lumovio/contracts";
import { useEffect } from "react";
import { useCopyText } from "@/components/sources/copy-text";
import type { QualityMark } from "@/components/sources/QualityBadges";

export interface CopyFace {
  marks: QualityMark[];
  heard: string | null;
}

/**
 * A TorrServer copy for the hero's line, as a found release is said (docs/torrserver-2026-11.md, 16): its release
 * name's marks and what this profile hears. Its own chunk, loaded only for such a copy, so the title's first load doesn't
 * carry the release names' reading (as ./TorrentProbe for the search). Draws nothing.
 */
export function CopyProbe({ copy, all, originalLanguage, onChange }: { copy: Availability; all: Availability[]; originalLanguage: string | null; onChange: (face: CopyFace) => void }) {
  const copyText = useCopyText();
  const marks = copyText.quality(copy, all, originalLanguage).marks;
  const heard = copyText.sound(copy, all, originalLanguage);
  const key = `${marks.join(",")}|${heard ?? ""}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: tells the hero when the words change
  useEffect(() => onChange({ marks, heard }), [key]);
  return null;
}
