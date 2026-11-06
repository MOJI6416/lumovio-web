"use client";

import type { ContinueWatchingItem } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatRuntime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { LandscapeCard } from "./LandscapeCard";
import { Row } from "./Row";

/**
 * "Continue watching" (and "Next episode" in the library): landscape cards straight to the player, with ▶, the episode
 * and the time left on the frame ("▶ Season 2 · episode 3 · 18 min left", 2.3) and the progress along its bottom. Its
 * "More" menu is shown on touch screens too and holds "Remove from Continue watching" — gone at once, "Undo" in the
 * toast brings it back where it was (HOME-01, 8.3) — and "More info" for the title page.
 */
export function ContinueRow({ items: initial, title: heading, id = "continue" }: { items: ContinueWatchingItem[]; title?: string; id?: string }) {
  const t = useTranslations();
  const qc = useQueryClient();
  // Removed cards are hidden here until the shelf's data says the same; the cards themselves always come
  // from the props, so a refetched shelf (library) and an undo after the shelf was re-created both hold.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const items = initial.filter((i) => !hidden.has(i.title.id));

  const remove = useAction({
    run: (item: ContinueWatchingItem) => api(`/api/continue/${item.title.id}`, { method: "DELETE" }),
    optimistic: (item) => {
      const titleId = item.title.id;
      setHidden((s) => new Set(s).add(titleId));
      return () =>
        setHidden((s) => {
          const next = new Set(s);
          next.delete(titleId);
          return next;
        });
    },
    success: (_r, item) => t("rows.removedFromContinue", { title: item.title.title }),
    undo: (_r, item) => api(`/api/continue/${item.title.id}/restore`, { method: "POST", json: {} }),
    error: (_e, item) => t("rows.removeFromContinueFailed", { title: item.title.title }),
    sync: () => qc.invalidateQueries({ queryKey: ["continue"] }),
  });

  const minutes = (sec: number) => formatRuntime(Math.round(sec / 60), (k, v) => t(k as "common.minutes", v)) ?? "";
  return (
    <Row title={heading ?? t("rows.continueWatching")} id={id} kind="landscape" min={1}>
      {items.map((item) => {
        const { title, progress, next } = item;
        const s = next?.season ?? progress.season;
        const e = next?.episode ?? progress.episode;
        const href = `/watch/${title.kind}/${title.tmdbId}${s !== null && e !== null ? `?s=${s}&e=${e}` : ""}`;
        const left = progress.durationSec ? Math.max(0, progress.durationSec - progress.positionSec) : null;
        const meta = next
          ? [t("card.nextEpisode", { season: next.season, episode: next.episode })]
          : [s !== null && e !== null ? t("card.episode", { season: s, episode: e }) : null, left === null ? null : left < 60 ? t("card.leftUnderMinute") : t("rows.timeLeft", { time: minutes(left) })];
        return (
          <LandscapeCard
            key={title.id}
            title={title}
            href={href}
            meta={meta}
            label={[title.title, ...meta].filter(Boolean).join(", ")}
            plays
            progress={next ? 0 : progress.fraction}
            showState={false}
            moreVisibility="always"
            more={{ details: true, remove: { label: t("card.removeFromContinue"), run: () => void remove.run(item) } }}
          />
        );
      })}
    </Row>
  );
}
