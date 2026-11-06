"use client";

import type { FeaturedTitle, Genre } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { CardRating, ratingText } from "@/components/media/CardRating";
import { TitleLogo } from "@/components/media/TitleLogo";
import { tmdbImage } from "@/lib/images";
import type { TvItem } from "./types";

/*
 * The TV's spotlight (design-system 10.3): the top of a screen of shelves shows the title in focus — its backdrop over
 * the whole screen, its name (logo for featured titles), one line of facts, why it's here and three lines of its
 * description — so the cards themselves stay plain posters. The text follows the focus at once; the picture only once
 * the focus rests (a held arrow doesn't download and decode a backdrop per card).
 */

/**
 * How long the focus rests before the picture changes. A new backdrop (decode, upload, fade over the scrims) costs a
 * TV ~100 ms of frames — on the owner's TCL a press landing in them took 150–170 ms to show instead of 40–50 — so
 * walking at a person's pace changes none: at 600 ms, presses 0.7 s apart down the shelves met every change (p50 88 ms
 * against 56 ms at 0.4 or 1.5 s apart, 2026-11-06), so the picture waits a whole second of rest.
 */
const ART_DELAY = 1000;

export function TvBackdrop({ src }: { src: string | null }) {
  const [shown, setShown] = useState(src);
  useEffect(() => {
    if (src === shown) return;
    const timer = window.setTimeout(() => {
      if (!src) return setShown(null);
      // Shown once decoded, so the frame that shows it only draws it.
      const img = new Image();
      img.src = src;
      img.decode().then(
        () => setShown(src),
        () => setShown(null),
      );
    }, ART_DELAY);
    return () => window.clearTimeout(timer);
  }, [src, shown]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {shown && (
        <img
          key={shown}
          src={shown}
          alt=""
          className="animate-fade-in absolute end-0 top-0 h-4/5 w-4/5 object-cover object-top"
        />
      )}
      {/* The scrims of the stage (3.5): from the start edge under the text, and from the bottom under the shelves. */}
      <div className="absolute inset-0 bg-linear-to-r from-stage from-20% via-stage/70 via-45% to-transparent to-80%" />
      <div className="absolute inset-0 bg-linear-to-t from-stage from-30% via-stage/60 via-55% to-transparent to-80%" />
    </div>
  );
}

export const backdropOf = (item: TvItem | null) => tmdbImage(item?.title.backdropPath, "w1280");

export function Spotlight({
  item,
  genres,
  children,
}: {
  item: TvItem | null;
  genres: Genre[];
  children?: ReactNode;
}) {
  const tc = useTranslations("common");
  const locale = useLocale();
  if (!item) return null;
  const x = item.title;
  const logo = (x as FeaturedTitle).logo ?? null;
  const names = new Map(genres.map((g) => [g.id, g.name]));
  const kind = x.isAnime ? tc("anime") : x.kind === "tv" ? tc("series") : tc("movie");
  const facts = [
    x.year ? String(x.year) : null,
    kind,
    ...x.genreIds
      .slice(0, 2)
      .map((id) => names.get(id))
      .filter(Boolean),
    x.runtime ? tc("minutes", { count: x.runtime }) : null,
  ]
    .filter(Boolean)
    .map((s) => (s as string).charAt(0).toLocaleUpperCase(locale) + (s as string).slice(1));
  const name = <h2 className="line-clamp-2 text-h1 text-text-1">{x.title}</h2>;
  return (
    <div className="flex w-full max-w-200 flex-col gap-4">
      <div className="flex min-h-20 items-end [--logo-h:5rem]">
        {logo ? (
          <TitleLogo logo={logo} alt={x.title} className="max-w-120">
            {name}
          </TitleLogo>
        ) : (
          name
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-l text-text-2">
        {ratingText(x, locale) && <CardRating title={x} className="text-text-1" />}
        {facts.map((f, i) => (
          <span key={`${f}${i}`} className="flex items-center gap-3">
            {(i > 0 || ratingText(x, locale)) && <span aria-hidden>·</span>}
            {f}
          </span>
        ))}
      </p>
      {item.note && (
        <p className="line-clamp-1 text-body-l font-semibold text-text-1 tabular-nums">{item.note}</p>
      )}
      {x.overview && <p className="line-clamp-3 max-w-measure text-body-l text-text-2">{x.overview}</p>}
      {children}
    </div>
  );
}
