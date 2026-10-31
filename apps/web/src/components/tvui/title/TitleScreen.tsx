"use client";

import type { CastMember, TitleDetails, TitleSummary } from "@lumovio/contracts";
import { User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { TitleLogo } from "@/components/media/TitleLogo";
import type { TitleCore } from "@/components/title/core";
import { cn } from "@/components/ui/cn";
import { Link } from "@/i18n/navigation";
import { tmdbImage } from "@/lib/images";
import { personHref } from "@/lib/slug";
import { TvCard } from "../media/TvCard";
import { TvShelfFrame } from "../media/TvShelf";
import { Episodes } from "./Episodes";
import { Ratings } from "./Ratings";
import { TitleActions } from "./TitleActions";

/*
 * A title on a TV (S06, S07 TV; TV document §4 "Страница тайтла"): its art over the whole screen, the name (logo), the
 * main ratings and facts, the description and the actions at the top, where the screen starts — on the main button;
 * below, one zone at a time: the seasons and episodes of a series, more like it, the cast. The page slides so the
 * focused zone is in view (`nearest`); ↑ from the first zone below goes back to the actions.
 */
export function TitleScreen({
  details: d,
  core,
  related,
  facts,
}: {
  details: TitleDetails;
  core: TitleCore;
  related: TitleSummary[];
  facts: string[];
}) {
  const t = useTranslations("title");
  const locale = useLocale();
  const cast = d.cast.slice(0, 20);
  const series = d.kind === "tv" && d.seasons.length > 0;
  const backdrop = tmdbImage(d.backdropPath, "w1280");
  const original = d.originalTitle && d.originalTitle !== d.title ? d.originalTitle : null;
  return (
    <div data-tv-screen="detail" className="stage relative h-full overflow-hidden bg-stage">
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          fetchPriority="high"
          className="pointer-events-none absolute end-0 top-0 h-4/5 w-4/5 object-cover object-top"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-r from-stage from-20% via-stage/75 via-45% to-transparent to-80%"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-stage from-25% via-stage/50 via-50% to-transparent to-75%"
      />
      <div data-tv-scroller className="absolute inset-0 overflow-hidden">
        <div data-tv-content data-zone-group className="flex flex-col gap-12 pb-24">
          <header
            data-zone-frame="top"
            className="flex min-h-(--tv-title-h) max-w-220 flex-col justify-end gap-4 ps-(--tv-pad) pt-12"
          >
            <h1 className="[--logo-h:7rem]">
              {d.logo ? (
                <TitleLogo logo={d.logo} alt={d.title} className="max-w-140 object-contain">
                  <span className="block text-display text-text-1">{d.title}</span>
                </TitleLogo>
              ) : (
                <span className="block text-display text-text-1">{d.title}</span>
              )}
            </h1>
            {original && (
              <p className="text-body text-text-2" lang={d.originalLanguage ?? undefined}>
                {original}
              </p>
            )}
            <Ratings kind={d.kind} tmdbId={d.tmdbId} tmdbRating={d.tmdbRating} tmdbVotes={d.tmdbVotes} />
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-l text-text-2">
              {facts.map((f, i) => (
                <span key={`${f}${i}`} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden>·</span>}
                  <bdi>{f}</bdi>
                </span>
              ))}
            </p>
            {d.overview && <p className="line-clamp-4 max-w-measure text-body-l text-text-2">{d.overview}</p>}
            <div className="pt-2">
              <TitleActions title={core} />
            </div>
          </header>
          {series && <Episodes title={core} />}
          {related.length > 0 && (
            <TvShelfFrame id="related" title={t("related")}>
              {related.map((x, i) => (
                <TvCard key={x.id} title={x} index={i} />
              ))}
            </TvShelfFrame>
          )}
          {cast.length > 0 && (
            <TvShelfFrame id="cast" title={t("cast")}>
              {cast.map((p) => (
                <Person key={`${p.id}-${p.character ?? ""}`} person={p} locale={locale} />
              ))}
            </TvShelfFrame>
          )}
        </div>
      </div>
    </div>
  );
}

function Person({ person: p, locale }: { person: CastMember; locale: string }) {
  const src = tmdbImage(p.profilePath, "w185");
  return (
    <Link
      prefetch={false}
      href={personHref(p.id, p.name)}
      data-key={String(p.id)}
      aria-label={[p.name, p.character].filter(Boolean).join(" — ")}
      className="tv-focus group/p flex w-40 shrink-0 flex-col items-center gap-3 rounded-md p-2"
    >
      <span className="grid size-36 place-items-center overflow-hidden rounded-full bg-surface-2">
        {src ? (
          <img src={src} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <User aria-hidden className="size-12 text-text-3" />
        )}
      </span>
      <span
        className="line-clamp-2 text-center text-body font-semibold text-text-1"
        lang={/^[\p{Script=Latin}\s.'-]+$/u.test(p.name) && locale !== "en" ? "en" : undefined}
      >
        {p.name}
      </span>
      {p.character && (
        <span className={cn("line-clamp-1 text-center text-body-s text-text-2")}>{p.character}</span>
      )}
    </Link>
  );
}
