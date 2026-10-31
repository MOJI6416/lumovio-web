"use client";

import type { MediaKind } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { Popover } from "@/components/ui/Popover";
import { usePathname } from "@/i18n/navigation";
import { RatingList } from "./RatingList";
import { creditLine, ratingItems, useTitleExternal } from "./ratings";

/**
 * "All ratings" (7.14 item 3, TTL-10, TTL-21): every source with its value and origin in a popover (a sheet on a
 * phone), who delivered the scores at its foot, and "How it's calculated" for the Lumovio Score in the Details tab.
 * Loaded by HeroRatings when its button is approached.
 */
export function AllRatings({
  kind,
  tmdbId,
  tmdbRating,
  tmdbVotes,
  title,
  initialOpen,
  focusTrigger,
}: {
  kind: MediaKind;
  tmdbId: number;
  tmdbRating: number | null;
  tmdbVotes: number | null;
  title: string;
  initialOpen: boolean;
  focusTrigger: boolean;
}) {
  const t = useTranslations("titlePage");
  const tr = useTranslations("ratings");
  const pathname = usePathname();
  const q = useTitleExternal(kind, tmdbId);
  const [open, setOpen] = useState(initialOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when it takes the light button's place
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, []);
  const items = ratingItems(q.data, kind, tmdbId, tmdbRating, tmdbVotes);
  const score = q.data?.score ?? null;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      title={t("allRatingsOf", { title })}
      showTitle
      align="start"
      trigger={
        <Button ref={trigger} variant="tertiary" size="sm" className="-ms-3">
          {t("allRatings")}
        </Button>
      }
    >
      {/* The list scrolls within the popover so it never runs past the window; "How it works" is at its top. */}
      <div className="-me-2 max-h-[min(24rem,45vh)] overflow-y-auto pe-2">
        <RatingList
          items={items}
          score={score}
          kind={kind}
          scoreLink={
            <Link variant="action" arrow href={`${pathname}?tab=details#lumovio-score`} replace onClick={() => setOpen(false)}>
              {t("scoreHow")}
            </Link>
          }
        />
      </div>
      <p className="mt-3 border-t border-line pt-3 text-caption text-text-3">{tr("sources", { sources: creditLine(q.data) })}</p>
    </Popover>
  );
}
