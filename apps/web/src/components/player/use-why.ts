"use client";

import { useTranslations } from "next-intl";
import { playbackReasons } from "@/lib/media/explain";

/** Why a file is rebuilt, transcoded or needs another player, in words (PLR-06, PLR-08): one sentence per reason. */
export function useWhy() {
  const t = useTranslations("player");
  return (note: string | null | undefined): string[] =>
    playbackReasons(note).map((r) => (r.value ? t(`why_${r.kind}`, { value: r.value }) : t(`why_${r.kind}Any`)));
}
