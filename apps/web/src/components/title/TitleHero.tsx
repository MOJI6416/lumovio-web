import type { TitleDetails } from "@lumovio/contracts";
import { clsx } from "clsx";
import { getLocale, getTranslations } from "next-intl/server";
import { Fragment, type ReactNode } from "react";
import { TitleLogo } from "@/components/media/TitleLogo";
import { FanartBackdrop } from "@/components/title/FanartBackdrop";
import { AgeRating } from "@/components/ui/Badge";
import { Link } from "@/components/ui/Link";
import { capitalize, formatRuntime } from "@/lib/format";
import { BACKDROP_SIZES, backdropSrcSet, preloadBackdrop, tmdbImage } from "@/lib/images";
import { personHref } from "@/lib/slug";
import { ExpandableText } from "./ExpandableText";
import { HeroRatings } from "./HeroRatings";

// Links in the credits line: a 44 px target on a phone and 32+ on a computer (5.6, TTL-29) without moving the line —
// an inline element's vertical padding grows what can be pressed, not the line box, and its side padding is taken
// back by an equal negative margin, so a short genre ("War", "Жахи") is wide enough too.
const CREDIT = "-mx-2 px-2 py-3.5 font-semibold md:py-2";

/**
 * The title's hero (design-system 7.14, 3.5, 10.1): the logo or the name in `display` (and the original name when it
 * differs), "Film · 2021 · 2 h 35 min" with the age rating, up to three ratings and "All ratings", the overview in three
 * lines with "More", the director or creators and the genres as links, then the actions (`children`, TitleActions).
 * The art is a stage: dark in either theme, text on its scrims, a straight edge where a light page begins.
 *
 * Phone: the art in a 2:1 band under the header and the text under it; the actions come right after the metadata, so
 * the main button and the row of three are on the first screen (10.1). Without any art (TTL-17) the hero is a plain
 * page header — no empty stage above the name.
 */
export async function TitleHero({ details: d, children }: { details: TitleDetails; children: ReactNode }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const runtime = formatRuntime(d.runtime, (k, v) => t(k as "common.minutes", v));
  const people = d.kind === "movie" ? d.crew.filter((c) => c.job === "Director").slice(0, 2) : d.creators.slice(0, 2);
  const kind = d.isAnime ? t("common.anime") : d.kind === "movie" ? t("common.movie") : t("common.series");
  // A Fanart.tv background stands in when TMDB has no backdrop (with the poster layout underneath).
  const wide = Boolean(d.backdropPath || d.altBackdrop);
  // The backdrop is the title page's largest paint: fetched from the head.
  preloadBackdrop(d.backdropPath);
  const art = Boolean(wide || d.posterPath);
  const original = d.originalTitle && d.originalTitle !== d.title ? d.originalTitle : null;
  const meta = [kind, d.year, runtime, d.kind === "tv" && d.numberOfSeasons ? t("common.seasons", { count: d.numberOfSeasons }) : null].filter((x) => x !== null && x !== undefined && x !== "");

  return (
    <header
      data-hero={art ? "" : undefined}
      className={clsx("relative isolate flex flex-col justify-end overflow-hidden", art && "stage -mt-16 bg-stage md:min-h-[min(88svh,60rem)]")}
    >
      {art && (
        <>
          <div className="absolute inset-x-0 top-16 -z-20 aspect-2/1 overflow-hidden md:inset-0 md:aspect-auto">
            {d.backdropPath ? (
              <img
                src={tmdbImage(d.backdropPath, "w1280") ?? undefined}
                srcSet={backdropSrcSet(d.backdropPath)}
                sizes={BACKDROP_SIZES}
                alt=""
                fetchPriority="high"
                className="size-full object-cover object-[50%_30%] md:object-[50%_20%]"
              />
            ) : d.posterPath ? (
              // No backdrop: a blurred field from the poster, and the poster itself whole — never a
              // portrait poster stretched behind the text with its own lettering competing.
              <>
                <img src={tmdbImage(d.posterPath, "w342") ?? undefined} alt="" className="size-full scale-110 object-cover opacity-60 blur-2xl" />
                <img
                  src={tmdbImage(d.posterPath, "w500") ?? undefined}
                  alt=""
                  fetchPriority="high"
                  className="absolute inset-y-3 start-1/2 h-[calc(100%-24px)] w-auto -translate-x-1/2 rounded-sm shadow-float md:max-lg:hidden md:inset-y-auto md:end-12 md:start-auto md:top-1/2 md:h-auto md:w-[min(26vw,320px)] md:-translate-y-1/2 md:translate-x-0 rtl:translate-x-1/2 md:rtl:translate-x-0"
                />
              </>
            ) : null}
            {!d.backdropPath && d.altBackdrop && <FanartBackdrop art={d.altBackdrop} />}
            {/* The band's lower edge fades into the dark area the title sits on. */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-stage to-transparent md:hidden" />
          </div>
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-stage/70 to-transparent max-md:hidden" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-stage/92 via-stage/55 via-45% to-transparent to-75% max-md:hidden rtl:bg-linear-to-l" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[60%] bg-linear-to-t from-stage via-stage/70 to-transparent max-md:hidden" />
        </>
      )}

      <div
        className={clsx(
          "page-x mx-auto w-full max-w-media",
          art ? "pb-8 md:pt-40 md:pb-14" : "pt-8 pb-6 md:pt-12",
          art && (wide ? "pt-[calc(4rem+50vw-40px)]" : "pt-[calc(4rem+50vw+12px)]"),
        )}
      >
        {/* Phones put the actions right under the metadata (10.1); the rest follows them. */}
        <div className="flex max-w-180 animate-fade-up flex-col">
          <h1 className="text-balance">
            {d.logo ? (
              <TitleLogo
                logo={d.logo}
                alt={d.title}
                className={clsx(
                  "max-w-[82vw] object-contain md:max-w-[32.5rem]",
                  // The logo's height limit (6.5: up to 160 px on a computer, 96 on a phone; a wide one lower).
                  d.logo.aspectRatio > 3.2 ? "[--logo-h:4.5rem] md:[--logo-h:8rem]" : "[--logo-h:6rem] md:[--logo-h:10rem]",
                )}
              >
                <span className="block text-display">{d.title}</span>
              </TitleLogo>
            ) : (
              <span className="block text-display">{d.title}</span>
            )}
          </h1>
          {original && (
            <p className="mt-2 text-body-s text-text-2" lang={d.originalLanguage ?? undefined}>
              {original}
            </p>
          )}
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-body-s font-semibold text-text-2 md:text-body">
            {meta.map((m, i) => (
              <Fragment key={String(m)}>
                {i > 0 && <span aria-hidden>·</span>}
                {/* Each fact keeps its own direction: "2 h 35 min" stays in that order on an RTL page (8.11). */}
                <bdi>{m}</bdi>
              </Fragment>
            ))}
            {d.certification && <AgeRating rating={d.certification} className="ms-1" />}
          </p>
          <div className="mt-4 max-md:order-2">
            <HeroRatings kind={d.kind} tmdbId={d.tmdbId} tmdbRating={d.tmdbRating} tmdbVotes={d.tmdbVotes} />
          </div>
          <div className="mt-4 max-md:order-3">
            {d.overview ? (
              <ExpandableText text={d.overview} lines={3} label={t("titlePage.readOverview")} className="text-body-l text-text-1" />
            ) : (
              <p className="text-body-s text-text-2">{t("title.noOverview")}</p>
            )}
          </div>
          {(people.length > 0 || d.genres.length > 0) && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body-s text-text-2 max-md:order-4">
              {people.length > 0 && (
                <span>
                  {d.kind === "movie" ? t("title.directedBy") : t("title.createdBy")}{" "}
                  {people.map((p, i) => (
                    <Fragment key={p.id}>
                      {i > 0 && ", "}
                      <Link href={personHref(p.id, p.name)} className={CREDIT}>
                        {p.name}
                      </Link>
                    </Fragment>
                  ))}
                </span>
              )}
              {d.genres.length > 0 && (
                <span>
                  {d.genres.slice(0, 4).map((g, i) => (
                    <Fragment key={g.id}>
                      {i > 0 && ", "}
                      <Link href={`/browse/${d.kind}?genres=${g.id}`} className={CREDIT}>
                        {capitalize(g.name, locale)}
                      </Link>
                    </Fragment>
                  ))}
                </span>
              )}
            </p>
          )}
          <div className="mt-6 max-md:order-1 max-md:mt-5 max-md:mb-2">{children}</div>
        </div>
      </div>
    </header>
  );
}
