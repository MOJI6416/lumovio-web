"use client";

import type { PersonSummary, TitleSummary } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import type { MouseEvent, ReactNode } from "react";
import { Artwork } from "@/components/media/Artwork";
import { CardRating } from "@/components/media/CardRating";
import { CARD_GAP_X, GRID_COLS, SHELF_COLS } from "@/components/media/card-sizes";
import { PersonCard } from "@/components/media/PersonCard";
import { PosterCard, PosterCardSkeleton, useCardMark, useRatingText } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { cn } from "@/components/ui/cn";
import { Link as ActionLink } from "@/components/ui/Link";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "@/i18n/navigation";
import { latinLang } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import { personHref, titleHref } from "@/lib/slug";
import { departmentKey } from "./search-helpers";
import type { BestMatch, GroupKey, SearchGroups } from "./search-model";

/** A person's department in words (the person page's), not TMDB's "Acting"; nothing for one TMDB adds later (SRCH-06). */
function useDepartment() {
  const t = useTranslations();
  return (p: PersonSummary) => {
    const k = departmentKey(p.knownFor);
    return k ? t(k as "person.dept0") : null;
  };
}

/** "Film · 2021 · Science Fiction, Adventure · IMDb 8.0": the type, the year, up to two genres and the card's rating. */
function TitleFacts({ title, genres }: { title: TitleSummary; genres: Record<number, string> }) {
  const t = useTranslations("common");
  const kind = title.isAnime ? t("anime") : title.kind === "movie" ? t("movie") : t("series");
  const names = title.genreIds
    .map((g) => genres[g])
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  const rated = Boolean(title.lumovioScore || title.imdbRating || title.tmdbRating);
  const parts = [kind, title.year, names].filter(Boolean);
  // " · " between the facts, never at a line's start (2.2): the dot holds on to the fact before it.
  return (
    <p className="mt-2 flex flex-wrap items-baseline text-body text-text-2">
      {parts.map((part, i) => (
        <span key={String(part)} className="whitespace-nowrap">
          {part}
          {(i < parts.length - 1 || rated) && <span aria-hidden>&nbsp;·&nbsp;</span>}
        </span>
      ))}
      {rated && <CardRating title={title} className="text-text-1" />}
    </p>
  );
}

/**
 * The best match (design-system 9 "Search"): bigger than the rest, above the groups. A title — its backdrop 16:9 (the
 * poster where there is none) with the personal mark and progress, the name, type, year, genres and rating; a person —
 * the round photo, the name and the department. The whole block is one link.
 */
export function BestMatchBlock({ best, genres }: { best: BestMatch; genres: Record<number, string> }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const dept = useDepartment();
  const heading = (
    <h2 id="best-h" className="mb-3 text-h2 text-text-1 md:mb-4">
      {t("bestMatch")}
    </h2>
  );
  if (best.type === "person") {
    const p = best.person;
    return (
      <section aria-labelledby="best-h">
        {heading}
        <Link
          href={personHref(p.id, p.name)}
          aria-label={[p.name, dept(p)].filter(Boolean).join(", ")}
          className="group/link group/card flex items-center gap-5 rounded-md focus-visible:outline-none md:gap-8"
        >
          <Artwork shape="person" src={tmdbImage(p.profilePath, "w185")} placeholder="person" className="w-28 shrink-0 md:w-40" />
          <span className="min-w-0">
            <span className="block text-h2 text-text-1 md:text-h1" lang={latinLang(p.name, locale)}>
              {p.name}
            </span>
            {dept(p) && <span className="mt-1 block text-body text-text-2">{dept(p)}</span>}
          </span>
        </Link>
      </section>
    );
  }
  return <BestTitle title={best.title} genres={genres} heading={heading} />;
}

function BestTitle({ title, genres, heading }: { title: TitleSummary; genres: Record<number, string>; heading: ReactNode }) {
  const locale = useLocale();
  const tc = useTranslations("common");
  const tl = useTranslations("title");
  const ratingLabel = useRatingText();
  const { state, mark } = useCardMark(title);
  const wide = Boolean(title.backdropPath);
  // Named as a card is (PosterCard): "Dune (2021), Film, IMDb 8.0, Watched".
  const label = [
    `${title.title}${title.year ? ` (${title.year})` : ""}`,
    title.isAnime ? tc("anime") : title.kind === "movie" ? tc("movie") : tc("series"),
    ratingLabel(title),
    mark === "watched" ? tl("watched") : mark === "watchlist" ? tl("watchlistRemove") : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <section aria-labelledby="best-h">
      {heading}
      <Link
        href={titleHref(title.kind, title.tmdbId, title.title)}
        data-title-id={title.id}
        aria-label={label}
        className={cn(
          "group/link group/card grid items-center gap-4 rounded-md focus-visible:outline-none md:gap-8",
          wide ? "md:grid-cols-[minmax(0,28rem)_1fr]" : "grid-cols-[auto_1fr]",
        )}
      >
        <Artwork
          shape={wide ? "landscape" : "poster"}
          src={wide ? tmdbImage(title.backdropPath, "w780") : tmdbImage(title.posterPath, "w342")}
          placeholder={title.kind}
          priority
          mark={mark}
          progress={state?.progress?.fraction ?? null}
          className={cn("rounded-md", !wide && "w-40 md:w-48")}
        />
        <span className="min-w-0">
          <span className="block text-h2 text-text-1 md:text-h1" lang={latinLang(title.title, locale)}>
            {title.title}
          </span>
          {title.originalTitle && title.originalTitle !== title.title && (
            <span className="mt-1 block truncate text-body text-text-3" lang={title.originalLanguage ?? undefined}>
              {title.originalTitle}
            </span>
          )}
          <TitleFacts title={title} genres={genres} />
        </span>
      </Link>
    </section>
  );
}

/**
 * The groups under the best match: films, series and people, each a shelf in the answer's order. A title group with
 * more than its shelf shows has "See all" — the type's whole list in place (`onScope`), a real address for a new tab.
 */
export function ResultGroups({
  groups,
  more,
  onScope,
  scopeHref,
}: {
  groups: SearchGroups;
  /** Whether the type has more than its shelf shows. */
  more: (k: "movie" | "tv") => boolean;
  onScope: (k: GroupKey) => void;
  scopeHref: (k: GroupKey) => string;
}) {
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const tl = useTranslations("library");
  const dept = useDepartment();
  const title = (k: GroupKey) => (k === "movie" ? tl("filterMovies") : k === "tv" ? tl("filterSeries") : t("people"));
  const seeAll = (k: GroupKey) => (
    <ActionLink
      variant="action"
      arrow
      href={scopeHref(k)}
      aria-label={`${tc("seeAll")}: ${title(k)}`}
      className="justify-end max-sm:min-w-11"
      onClick={(e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onScope(k);
      }}
    >
      {tc("seeAll")}
    </ActionLink>
  );
  return (
    <>
      {groups.order.map((k) =>
        k === "people" ? (
          <div key={k} className="-mx-(--gutter)">
            <Row id="search-people" kind="person" title={title(k)}>
              {groups.people.map((p) => (
                <PersonCard key={p.id} person={p} subtitle={dept(p)} />
              ))}
            </Row>
          </div>
        ) : (
          <div key={k} className="-mx-(--gutter)">
            <Row id={`search-${k}`} title={title(k)} actions={more(k) ? seeAll(k) : undefined}>
              {groups[k].map((x) => (
                <PosterCard key={x.id} title={x} />
              ))}
            </Row>
          </div>
        ),
      )}
    </>
  );
}

/** Everyone the search found, as a grid of round photos (the "People" type). */
export function PeopleGrid({ people }: { people: PersonSummary[] }) {
  const dept = useDepartment();
  return (
    <div className={cn("grid gap-y-6", GRID_COLS.person, CARD_GAP_X)}>
      {people.map((p) => (
        <PersonCard key={p.id} person={p} subtitle={dept(p)} />
      ))}
    </div>
  );
}

/** The answer's first look while it comes: the best match and a shelf, in their places. */
export function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden>
      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,28rem)_1fr] md:gap-8">
        <Skeleton className="aspect-video w-full rounded-md" />
        <div className="space-y-3">
          <Skeleton shape="xs" className="h-9 w-3/5" />
          <Skeleton shape="xs" className="h-4 w-2/5" />
        </div>
      </div>
      <div className={cn("grid grid-flow-col overflow-hidden", SHELF_COLS.poster, CARD_GAP_X)}>
        {Array.from({ length: 8 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <PosterCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
