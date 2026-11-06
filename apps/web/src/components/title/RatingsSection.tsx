"use client";

import type { MediaKind } from "@lumovio/contracts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { type Brand, isWordmark } from "@/components/media/BrandMark";
import { ScoreMark } from "@/components/media/ScoreBadge";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Link } from "@/components/ui/Link";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { useHydrated } from "./hydrated";
import {
  creditLine,
  percent,
  RATINGS_ANCHOR,
  type RatingItem,
  RatingLogo,
  ratingGroup,
  ratingItems,
  ratingScale,
  SCORE_ANCHOR,
  sourceName,
  type TitleScore,
  useRatingCount,
  useRatingValue,
  useScoreNotes,
  useTitleExternal,
} from "./ratings";

type Group = "critics" | "audience";
const GROUPS: Group[] = ["critics", "audience"];

/**
 * A row of a source: its name, its meter, its value, its votes — the same columns in every group, so the meters of
 * critics and audience start and end on one line (7.22). From a tablet one line: the name keeps its width and the
 * meter takes what is left, up to 24 rem, so on a wide page the name stands at the start and the meter, value and
 * votes at the end, as a table's row. On a phone the name, value and votes are the line and the meter runs under it
 * across the row (METER_UNDER), as long as it can be.
 */
const ROW = "grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 md:grid-cols-[minmax(12rem,1fr)_minmax(0,24rem)_4.5rem_5rem] md:gap-x-4";
/** "How it's calculated": name, the share's meter, the share. */
const SHARE_ROW = "grid-cols-[minmax(0,1fr)_auto] gap-x-3 md:grid-cols-[minmax(12rem,1fr)_minmax(0,24rem)_4.5rem] md:gap-x-4";
const METER_UNDER = "max-md:col-span-full max-md:row-start-2 max-md:mt-1.5";

const FILL = { score: "bg-brand-mark", part: "bg-text-1", source: "bg-text-2", faint: "bg-text-3" } as const;

/** A number drawn on its scale, 0–100: a track with its share filled. The number beside it says it; the meter is only seen. */
function Meter({ value, tone = "source", className }: { value: number; tone?: keyof typeof FILL; className?: string }) {
  return (
    <span aria-hidden className={cn("block h-1 overflow-hidden rounded-full bg-surface-3", className)}>
      <span className={cn("block h-full rounded-full", FILL[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

/** A source's logo, and its name unless the logo spells it (a wordmark, whose alt is the name). */
function SourceLabel({ source, score }: { source: RatingItem["source"]; score?: number }) {
  const word = isWordmark(source as Brand);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden={!word} className="flex h-5 shrink-0 items-center">
        <RatingLogo source={source} score={score} />
      </span>
      {!word && <span className="min-w-0 text-body-s font-semibold text-text-1 md:text-body">{sourceName(source)}</span>}
    </span>
  );
}

function useGroupName() {
  const t = useTranslations("score");
  return (g: Group) => (g === "critics" ? t("groupCritics") : t("groupAudience"));
}

/**
 * The Lumovio Score as the section's lead: the number, what it means ("Higher than 96% of films"), its meter in the
 * mark's colour, and the critics' and audience's parts on the meters the sources use. A low-confidence score is drawn
 * faint and says why in a tag; "How it's calculated" opens the sources' shares under it.
 */
function ScorePanel({ score, kind, open, onToggle }: { score: TitleScore; kind: MediaKind; open: boolean; onToggle: () => void }) {
  const t = useTranslations("titlePage");
  const ts = useTranslations("score");
  const notes = useScoreNotes()(score);
  const groupName = useGroupName();
  const low = score.confidence === "low";
  const parts = GROUPS.map((g) => [g, g === "critics" ? score.critics : score.audience] as const).filter((p): p is readonly [Group, number] => p[1] != null);
  return (
    <div id={SCORE_ANCHOR} className="flex scroll-mt-32 flex-col rounded-md bg-surface-1 p-4 md:p-6 lg:col-start-1 lg:row-start-1">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-title text-text-1">
        <ScoreMark className="size-5" />
        {ts("name")}
        {notes.map((n) => (
          <Tag key={n} className="ms-1">
            {n}
          </Tag>
        ))}
      </p>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn("text-display tabular-nums", low ? "text-text-2" : "text-text-1")}>{score.score}</span>
        <span className="text-body text-text-2">{ts("rank", { score: score.score, kind })}</span>
      </p>
      <Meter value={score.score} tone={low ? "faint" : "score"} className="mt-3 h-2" />
      {parts.length > 0 && (
        <dl className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-3">
          {parts.map(([g, v]) => (
            <div key={g} className="col-span-full grid grid-cols-subgrid items-center">
              <dt className="text-body-s text-text-2">{groupName(g)}</dt>
              <dd aria-hidden>
                <Meter value={v} tone={low ? "faint" : "part"} />
              </dd>
              <dd className="text-end text-body font-semibold tabular-nums text-text-1">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {/* At the panel's foot when the sources beside it are taller. */}
      <div className="mt-auto pt-4">
        <Button variant="tertiary" size="sm" icon={open ? ChevronUp : ChevronDown} aria-expanded={open} aria-controls="score-how" className="-ms-3" onClick={onToggle}>
          {t("scoreHow")}
        </Button>
      </div>
    </div>
  );
}

/** "How it's calculated": each counted source's share of the score by group, what was left out and why, the method. */
function How({ score }: { score: TitleScore }) {
  const t = useTranslations("titlePage");
  const ts = useTranslations("score");
  const locale = useLocale();
  const groupName = useGroupName();
  const groups = GROUPS.map((g) => [g, score.inputs.filter((i) => i.group === g).sort((a, b) => b.share - a.share)] as const).filter(([, l]) => l.length > 0);
  return (
    // Under the two panels on a computer, right under its button on a phone (the grid's order).
    <div id="score-how" className="rounded-md bg-surface-1 p-4 md:p-6 lg:col-span-2 lg:row-start-2 lg:grid lg:grid-cols-2 lg:gap-x-12">
      <div className="flex flex-col gap-5">
        {groups.map(([g, list]) => (
          <div key={g} className={cn("grid", SHARE_ROW)}>
            <h3 className="col-span-full grid grid-cols-subgrid pb-1 text-body-s text-text-2">
              <span className="md:col-span-2">{groupName(g)}</span>
              <span className="text-end tabular-nums">{percent(list.reduce((s, i) => s + i.share, 0), locale)}</span>
            </h3>
            <ul className="col-span-full grid grid-cols-subgrid">
              {list.map((i) => (
                <li key={i.source} className="col-span-full grid grid-cols-subgrid items-center py-2">
                  <SourceLabel source={i.source} score={Number.parseInt(i.display, 10)} />
                  <Meter value={i.share} className={METER_UNDER} />
                  <span className="text-end text-body-s tabular-nums text-text-2">
                    <span aria-hidden>{percent(i.share, locale)}</span>
                    <span className="sr-only">{ts("share", { share: i.share })}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-6 lg:mt-0">
        {score.excluded.length > 0 && (
          <>
            <h3 className="pb-1 text-body-s text-text-2">{ts("notCounted")}</h3>
            <ul className="flex flex-col">
              {score.excluded.map((e) => (
                <li key={e.source} className="py-2 text-body-s text-text-2">
                  <span className="font-semibold text-text-1">{sourceName(e.source)}</span> — {ts(`reason.${e.reason}`)}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className={cn("text-caption text-text-3", score.excluded.length > 0 && "mt-4")}>
          {ts("disclaimer")} {t("scoreVersion", { version: score.version, date: formatDate(score.calibration, locale, { dateStyle: "long" }) ?? score.calibration })}
        </p>
        <Link variant="action" arrow href="/legal/credits#lumovio-score" className="mt-2">
          {ts("methodology")}
        </Link>
      </div>
    </div>
  );
}

/** A source in its group: logo and name, the meter of its number on its own scale, the number with its scale, the votes. */
function SourceRow({ r }: { r: RatingItem }) {
  const tr = useTranslations("ratings");
  const value = useRatingValue()(r);
  const count = useRatingCount()(r);
  const of = ratingScale(r.source);
  const cls = "col-span-full grid grid-cols-subgrid items-center py-2";
  const body = (
    <>
      <SourceLabel source={r.source} score={r.score} />
      <Meter value={r.score} className={METER_UNDER} />
      <span className="whitespace-nowrap text-end tabular-nums">
        <span aria-hidden>
          <span className="text-body font-semibold text-text-1">{value}</span>
          {of && <span className="text-caption text-text-3">/{of}</span>}
        </span>
        <span className="sr-only">{of ? tr("outOf", { value, scale: of }) : value}</span>
      </span>
      <span className="whitespace-nowrap text-end text-body-s tabular-nums text-text-3">
        {count && (
          <>
            <span aria-hidden>{count.short}</span>
            <span className="sr-only">{count.full}</span>
          </>
        )}
      </span>
    </>
  );
  return (
    <li className="col-span-full grid grid-cols-subgrid">
      {r.url ? (
        // The row is the link to the source's page; the subgrid keeps its columns (the margin and padding cancel out).
        <a href={r.url} target="_blank" rel="noreferrer noopener" className={cn(cls, "-mx-2 rounded-sm px-2 transition-colors duration-fast ease-fast hover:bg-surface-2")}>
          {body}
        </a>
      ) : (
        <span className={cls}>{body}</span>
      )}
    </li>
  );
}

/** The sources, critics then audience, each a quiet table: a heading with the votes' column named once, then a row each. */
function Sources({ items, apart, className }: { items: RatingItem[]; apart: boolean; className?: string }) {
  const groupName = useGroupName();
  const tr = useTranslations("ratings");
  const groups = GROUPS.map((g) => [g, items.filter((r) => ratingGroup(r.source) === g)] as const).filter(([, l]) => l.length > 0);
  // Without a Lumovio Score the two groups stand side by side on a computer, so neither stretches across the page.
  const side = apart && groups.length === 2;
  return (
    <div className={cn("rounded-md bg-surface-1 p-4 md:p-6", side && "lg:grid lg:grid-cols-2 lg:gap-x-12", className)}>
      {groups.map(([g, list], i) => (
        // content-start: beside a longer group its rows keep their height instead of spreading out.
        <div key={g} className={cn("grid content-start", ROW, i > 0 && (side ? "mt-5 lg:mt-0" : "mt-5"))}>
          <h3 id={`ratings-${g}`} className="col-span-full grid grid-cols-subgrid pb-1 text-body-s text-text-2">
            <span className="col-span-2 md:col-span-3">{groupName(g)}</span>
            {list.some((r) => r.count) && (
              <span aria-hidden className="text-end">
                {g === "critics" ? tr("reviewsHead") : tr("votesHead")}
              </span>
            )}
          </h3>
          <ul aria-labelledby={`ratings-${g}`} className="col-span-full grid grid-cols-subgrid">
            {list.map((r) => (
              <SourceRow key={r.source} r={r} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * "Ratings" in "Details" (7.22; TTL-10, TTL-21, C13; owner 2026-11-06: "I expected more"): the Lumovio Score as the lead
 * — the number, what it means, its meter, critics and audience — beside the sources split the same way, each source's
 * number drawn on a meter of its own scale so "8.4/10", "92%" and "4.4/5" read alike. "How it's calculated" opens the
 * shares; the hero's ratings line opens this section (#ratings), a link to #lumovio-score opens the shares too.
 */
export function RatingsSection({ kind, tmdbId, tmdbRating, tmdbVotes }: { kind: MediaKind; tmdbId: number; tmdbRating: number | null; tmdbVotes: number | null }) {
  const t = useTranslations("titlePage");
  const tr = useTranslations("ratings");
  const q = useTitleExternal(kind, tmdbId);
  const items = ratingItems(q.data, kind, tmdbId, tmdbRating, tmdbVotes);
  const score = q.data?.score ?? null;
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const ready = hydrated && !q.isPending;

  // Arriving from the hero's ratings (#ratings) or a link to the shares (#lumovio-score): in view, the shares open.
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      const id = window.location.hash.slice(1);
      if (id !== SCORE_ANCHOR && id !== RATINGS_ANCHOR) return;
      if (id === SCORE_ANCHOR) setOpen(true);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [ready]);

  if (!ready)
    return (
      <div className="page-x grid gap-3 md:gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full max-lg:hidden" />
      </div>
    );
  if (items.length === 0 && !score) return null;
  return (
    <section id={RATINGS_ANCHOR} aria-labelledby="ratings-h" className="page-x scroll-mt-32">
      <h2 id="ratings-h" className="mb-3 text-h2 text-text-1 md:mb-4">
        {t("ratings")}
      </h2>
      <div className={cn("grid gap-3 md:gap-4", score && items.length > 0 && "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
        {score && <ScorePanel score={score} kind={kind} open={open} onToggle={() => setOpen((o) => !o)} />}
        {score && open && <How score={score} />}
        {items.length > 0 && <Sources items={items} apart={!score} className={score ? "lg:col-start-2 lg:row-start-1" : undefined} />}
      </div>
      {/* Who delivered the scores, in a quiet line. */}
      <p className="mt-4 text-caption text-text-3">{tr("sources", { sources: creditLine(q.data) })}</p>
    </section>
  );
}
