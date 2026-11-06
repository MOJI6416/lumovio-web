"use client";

import type { MediaKind } from "@lumovio/contracts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { BrandMark, type Brand, isWordmark } from "@/components/media/BrandMark";
import { ScoreMark } from "@/components/media/ScoreBadge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Link } from "@/components/ui/Link";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { useHydrated } from "./hydrated";
import { useScoreNotes } from "./RatingList";
import { creditLine, RatingLogo, ratingItems, sourceName, useRatingMeta, useRatingValue, useTitleExternal } from "./ratings";

/** The anchor "All ratings" links to (`?tab=details#lumovio-score`): it opens "How it's calculated". */
const SCORE_ANCHOR = "lumovio-score";
/** A grid cell of three rows (name, number, votes) the tile inside shares with its neighbours (./Tile). */
const TILE_CELL = "row-span-3 grid grid-rows-subgrid gap-y-0";

/**
 * One source's score: its logo (and name, unless the logo spells it), the number, the votes behind it. The tile's three
 * lines are rows of the grid around it (subgrid, TTL-27): a name that wraps in one tile ("Rotten / Tomatoes") moves the
 * numbers of the whole row down together, so they stay on one line.
 */
function Tile({ href, logo, name, value, meta, large }: { href?: string | null; logo: ReactNode; name: string | null; value: ReactNode; meta?: ReactNode; large?: boolean }) {
  const body = (
    <>
      {/* The name wraps rather than being cut (8.11). */}
      <span className="flex min-h-5 items-start gap-2">
        <span className="flex h-5 shrink-0 items-center">{logo}</span>
        {name && <span className="min-w-0 text-body-s font-semibold text-text-2">{name}</span>}
      </span>
      <span className={cn("mt-2 block tabular-nums text-text-1", large ? "text-h1" : "text-h3")}>{value}</span>
      {meta && <span className="mt-0.5 block text-body-s text-text-2">{meta}</span>}
    </>
  );
  // A panel of the redesign: --surface-1, radius 16, no border (redesign-2026-11.md; the settings' groups).
  const box = "row-span-3 grid grid-rows-subgrid gap-y-0 rounded-md bg-surface-1 p-4";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className={cn(box, "transition-colors duration-fast ease-fast hover:bg-surface-2")}>
      {body}
    </a>
  ) : (
    <div className={box}>{body}</div>
  );
}

/**
 * "Ratings" in "Details" (TTL-10, TTL-21, C13; owner 2026-10-25): one compact grid of the sources — the Lumovio Score
 * first, then each source with its logo, number and votes, a link to its page — and who delivered them in the "i".
 * The date and the provider of each score are in the hero's "All ratings". "How the Lumovio Score is calculated" is
 * folded under the grid — what the number means, each source's share, what was left out and why, the methodology
 * page — and "All ratings" opens it (#lumovio-score).
 */
export function RatingsSection({ kind, tmdbId, tmdbRating, tmdbVotes }: { kind: MediaKind; tmdbId: number; tmdbRating: number | null; tmdbVotes: number | null }) {
  const t = useTranslations("titlePage");
  const ts = useTranslations("score");
  const tr = useTranslations("ratings");
  const locale = useLocale();
  const q = useTitleExternal(kind, tmdbId);
  const items = ratingItems(q.data, kind, tmdbId, tmdbRating, tmdbVotes);
  const score = q.data?.score ?? null;
  const hydrated = useHydrated();
  const value = useRatingValue();
  const meta = useRatingMeta();
  const notes = useScoreNotes();
  const [open, setOpen] = useState(false);
  const ready = hydrated && !q.isPending;

  // Arriving from "All ratings" (or a shared link to it): "How it's calculated" open and in view.
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      if (window.location.hash !== `#${SCORE_ANCHOR}`) return;
      setOpen(true);
      requestAnimationFrame(() => document.getElementById(SCORE_ANCHOR)?.scrollIntoView({ block: "start" }));
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [ready]);

  if (!ready)
    return (
      <div className="page-x">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  if (items.length === 0 && !score) return null;
  return (
    <section aria-labelledby="ratings-h" className="page-x">
      <h2 id="ratings-h" className="mb-3 text-h2 text-text-1 md:mb-4">
        {t("ratings")}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] md:gap-4">
        {score && (
          // The Lumovio Score first and twice as wide, its number large, "How it's calculated" in it (2026-11-06).
          <li className={cn(TILE_CELL, "col-span-2")}>
            <Tile
              large
              logo={<ScoreMark className="size-5" />}
              name={ts("name")}
              value={score.score}
              meta={
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {notes(score).length > 0 && <span>{notes(score).join(" ")}</span>}
                  <Button
                    variant="tertiary"
                    size="sm"
                    icon={open ? ChevronUp : ChevronDown}
                    aria-expanded={open}
                    aria-controls="score-how"
                    className="-ms-3"
                    onClick={() => setOpen((o) => !o)}
                  >
                    {t("scoreHow")}
                  </Button>
                </span>
              }
            />
          </li>
        )}
        {items.map((r) => (
          <li key={r.source} className={TILE_CELL}>
            <Tile
              href={r.url}
              logo={<RatingLogo source={r.source} score={r.score} />}
              name={isWordmark(r.source as Brand) ? null : sourceName(r.source)}
              value={value(r)}
              // The votes only: the date and who delivered it are in "All ratings".
              meta={r.count ? meta({ ...r, asOf: null, fetchedAt: null, via: "tmdb" })[0] : null}
            />
          </li>
        ))}
      </ul>
      {score && (
        <div id={SCORE_ANCHOR} className="scroll-mt-32">
          {open && (
            // The whole width of the grid above, as one more panel of it (it stood narrow at the start, 2026-11-06).
            <div id="score-how" className="mt-3 rounded-md bg-surface-1 p-4 md:mt-4 md:p-6">
              <p className="max-w-measure text-body text-text-2">{t("scoreWhat", { score: score.score, kind })}</p>
              <p className="mt-2 max-w-measure text-body text-text-2">{t("scoreMade")}</p>
              <h3 className="mt-5 text-title text-text-1">{ts("counted")}</h3>
              <ul className="mt-3 flex flex-col gap-4">
                {score.inputs.map((i) => (
                  <li key={i.source}>
                    <div className="flex items-center justify-between gap-3 text-body-s">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <BrandMark brand={i.source as Brand} rotten={i.source === "rotten_tomatoes" && Number.parseInt(i.display, 10) < 60} />
                        {/* A wordmark already spells the name. */}
                        {!isWordmark(i.source as Brand) && <span className="font-semibold text-text-1">{sourceName(i.source)}</span>}
                        <span className="text-text-2">{i.group === "critics" ? ts("groupCritics") : ts("groupAudience")}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-text-2">{ts("share", { share: i.share })}</span>
                    </div>
                    <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-progress" style={{ width: `${i.share}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {score.excluded.length > 0 && (
                <>
                  <h3 className="mt-5 text-title text-text-1">{ts("notCounted")}</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {score.excluded.map((e) => (
                      <li key={e.source} className="text-body-s text-text-2">
                        <span className="font-semibold text-text-1">{sourceName(e.source)}</span> — {ts(`reason.${e.reason}`)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-5 text-body-s text-text-2">
                {ts("disclaimer")} {t("scoreVersion", { version: score.version, date: formatDate(score.calibration, locale, { dateStyle: "long" }) ?? score.calibration })}
              </p>
              <Link variant="action" arrow href="/legal/credits#lumovio-score" className="mt-2">
                {ts("methodology")}
              </Link>
            </div>
          )}
        </div>
      )}
      {/* Who delivered the scores, in a quiet line (it was in the "i", 2026-11-06). */}
      <p className="mt-4 text-caption text-text-3">{tr("sources", { sources: creditLine(q.data) })}</p>
    </section>
  );
}
