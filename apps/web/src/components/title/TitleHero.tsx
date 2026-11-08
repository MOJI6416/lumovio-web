import type { TitleDetails } from "@lumovio/contracts";
import { clsx } from "clsx";
import { getLocale, getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { TitleLogo } from "@/components/media/TitleLogo";
import { FanartBackdrop } from "@/components/title/FanartBackdrop";
import { AgeRating } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { capitalize, formatRuntime, latinLang } from "@/lib/format";
import { BACKDROP_SIZES, backdropSrcSet, preloadBackdrop, tmdbImage } from "@/lib/images";
import { personHref } from "@/lib/slug";
import type { TitleCore } from "./core";
import { ExpandableText } from "./ExpandableText";
import { HeroRatings } from "./HeroRatings";
import { TitleActions } from "./TitleActions";
import { YourRating } from "./YourRating";

// A name in the credits: white beside its grey role, underlined under the pointer (a list of names, not running text:
// four underlines in a row were noise; 7.14). Its own box, 44 px tall on a phone and 32 from a tablet (5.6), in rows
// exactly that tall: the targets of two lines meet and never overlap (an inline link's padding grew its target over the
// line below, and "Director" took the presses meant for the cast above it).
const CREDIT = "inline-flex min-h-11 items-center rounded-xs font-semibold text-text-1 underline-offset-3 hover:underline max-md:min-w-11 md:min-h-8";

/** Animation is said by "Anime" already: it isn't one of an anime's genres in its facts. */
const ANIMATION = 16;
const ENDED = new Set(["Ended", "Canceled"]);

/**
 * The title's hero (design-system 7.14, 3.5, 10.1; 2026-11-06, from scratch): what is needed to decide and to start, on
 * the art. The logo or the name in `display` (the original name under it when it differs); one line of facts as the
 * TV's — "Series · 2008–2013 · 5 seasons · Drama · Crime" and the age rating; the ratings with the profile's own one
 * at their end; the overview in three lines with "More"; the actions (main button by 8.2, "+", "•••") and the line of
 * where it plays from. Who made it and who is in it stand apart, at the foot of the right side on a computer, as Apple
 * TV's, under the overview on a phone — the names are links to their pages. The genres as links, the dates and the
 * rest are in "Details" below.
 *
 * The art is a stage: dark in either theme, text on its scrims, a straight edge where a light page begins. The picture
 * is never cut across (7.14, 2026-11-08: TMDB's backdrops are composed around their middle): from md on a screen no
 * taller than 5:4 it is a whole 16:9 picture on the end side, 80 % of the hero's width, with the text on the stage before
 * it, as on the TV; on a phone, a portrait tablet or a squarish window it is a band under the header (2:1 on a phone,
 * 16:9 from sm), the name under it, then the facts, the ratings and the actions on the first screen; the overview and
 * the credits after them (the reading order stays name → overview → actions). Without any art (TTL-17) the hero is a
 * plain page header — no empty stage above the name.
 */
export async function TitleHero({ details: d, core }: { details: TitleDetails; core: TitleCore }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const runtime = formatRuntime(d.runtime, (k, v) => t(k as "common.minutes", v));
  const kind = d.isAnime ? t("common.anime") : d.kind === "movie" ? t("common.movie") : t("common.series");
  // A Fanart.tv background stands in when TMDB has no backdrop (with the poster layout underneath).
  const wide = Boolean(d.backdropPath || d.altBackdrop);
  // The backdrop is the title page's largest paint: fetched from the head.
  preloadBackdrop(d.backdropPath);
  const art = Boolean(wide || d.posterPath);
  const original = d.originalTitle && d.originalTitle !== d.title ? d.originalTitle : null;
  // A finished series says its years ("2008–2013"): whether it has an end is part of deciding.
  const last = d.kind === "tv" && d.status && ENDED.has(d.status) ? Number(d.lastEpisode?.airDate?.slice(0, 4)) || null : null;
  const years = d.year && last && last > d.year ? `${d.year}–${last}` : d.year ? String(d.year) : null;
  const genres = d.genres.filter((g) => !(d.isAnime && g.id === ANIMATION)).slice(0, 2);
  const facts = [
    kind,
    years,
    runtime,
    d.kind === "tv" && d.numberOfSeasons ? t("common.seasons", { count: d.numberOfSeasons }) : null,
    ...genres.map((g) => capitalize(g.name, locale)),
  ].filter((x): x is string => Boolean(x));

  const makers = d.kind === "movie" ? d.crew.filter((c) => c.job === "Director").slice(0, 2) : d.creators.slice(0, 2);
  const cast = d.cast.slice(0, 3);
  // Each name whole with its comma; the line wraps between names, never inside one. A phone shows `phone` of them: a
  // third name there takes a 44 px line of its own, and the whole cast is a shelf further down anyway.
  const names = (people: { id: number; name: string }[], phone = people.length) =>
    people.map((p, i) => (
      <span key={p.id} className={clsx("inline-flex items-center whitespace-nowrap", i >= phone && "max-sm:hidden")}>
        {/* A name TMDB has only in Latin letters on a ru/uk page is marked with its language (8.11, L10N-11). */}
        <Link href={personHref(p.id, p.name)} className={CREDIT} lang={latinLang(p.name, locale)}>
          {p.name}
        </Link>
        {i < people.length - 1 && <span className={clsx(i === phone - 1 && "max-sm:hidden")}>,</span>}
      </span>
    ));
  const credits = (cast.length > 0 || makers.length > 0) && (
    <div data-credits className="mt-2 flex flex-col text-body-s text-text-2 md:mt-3 lg:mt-0">
      {cast.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1">
          <span>{t("title.cast")}</span>
          {names(cast, 2)}
        </p>
      )}
      {makers.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1">
          <span>{d.kind === "movie" ? t("title.directedBy") : t("title.createdBy")}</span>
          {names(makers)}
        </p>
      )}
    </div>
  );

  return (
    <header
      data-hero={art ? "" : undefined}
      className={clsx("relative isolate flex flex-col justify-end overflow-hidden", art && "stage -mt-16 bg-stage art-over:min-h-[min(88svh,60rem)]")}
    >
      {art && (
        <>
          {/* The art (7.14): a band under the header — 2:1 on a phone, 16:9 from sm — with the name under it; from md on a
              screen no taller than 5:4, a whole 16:9 picture on the end side, its start edge and foot dissolving into
              the stage the text stands on. A poster on its blurred field fills the hero there. */}
          <div
            className={clsx(
              "absolute inset-x-0 top-16 -z-20 aspect-2/1 overflow-hidden art-band:sm:aspect-video",
              wide
                ? "art-over:inset-x-auto art-over:end-0 art-over:top-0 art-over:aspect-video art-over:w-4/5 art-over:mask-b-from-75% art-over:ltr:mask-l-from-70% art-over:rtl:mask-r-from-70%"
                : "art-over:inset-0 art-over:aspect-auto",
            )}
          >
            {d.backdropPath ? (
              <img
                src={tmdbImage(d.backdropPath, "w1280") ?? undefined}
                srcSet={backdropSrcSet(d.backdropPath)}
                sizes={BACKDROP_SIZES}
                alt=""
                fetchPriority="high"
                // A 2:1 band loses a ninth of a 16:9 picture's height: its foot, where heads aren't.
                className="size-full object-cover object-[50%_10%]"
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
                  className="absolute inset-y-3 start-1/2 h-[calc(100%-24px)] w-auto -translate-x-1/2 rounded-sm shadow-float rtl:translate-x-1/2 art-over:max-lg:hidden art-over:inset-y-auto art-over:end-12 art-over:start-auto art-over:top-1/2 art-over:h-auto art-over:w-[min(26vw,320px)] art-over:-translate-y-1/2 art-over:translate-x-0 art-over:rtl:translate-x-0"
                />
              </>
            ) : null}
            {!d.backdropPath && d.altBackdrop && <FanartBackdrop art={d.altBackdrop} />}
            {/* The band's lower edge fades into the dark area the title sits on. */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-stage to-transparent art-over:hidden" />
          </div>
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-stage/70 to-transparent art-band:hidden" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-stage/92 via-stage/55 via-45% to-transparent to-75% art-band:hidden rtl:bg-linear-to-l" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[60%] bg-linear-to-t from-stage via-stage/70 to-transparent art-band:hidden" />
        </>
      )}

      <div
        className={clsx(
          "page-x mx-auto w-full max-w-media",
          art ? "pb-8 art-over:pt-40 art-over:pb-14" : "pt-8 pb-6 md:pt-12",
          // Under the band: the name comes up 40 px onto its fading foot (12 px below a poster).
          art && (wide ? "pt-[calc(4rem+50vw-40px)] art-band:sm:pt-[calc(4rem+56.25vw-40px)]" : "pt-[calc(4rem+50vw+12px)] art-band:sm:pt-[calc(4rem+56.25vw+12px)]"),
        )}
      >
        {/* The text on the left; the credits at the foot of the right side from a laptop, under the text below that. */}
        <div className="grid animate-fade-up lg:grid-cols-[minmax(0,40rem)_minmax(0,22rem)] lg:items-end lg:justify-between lg:gap-x-12">
          <div className="flex max-w-160 flex-col">
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
              {facts.map((m, i) => (
                <Fragment key={m}>
                  {i > 0 && <span aria-hidden>·</span>}
                  {/* Each fact keeps its own direction: "2 h 35 min" stays in that order on an RTL page (8.11). */}
                  <bdi className="whitespace-nowrap">{m}</bdi>
                </Fragment>
              ))}
              {d.certification && <AgeRating rating={d.certification} className="ms-1" />}
            </p>
            {/* The title's ratings, then the profile's own: what others think, and what you did. */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <HeroRatings kind={d.kind} tmdbId={d.tmdbId} tmdbRating={d.tmdbRating} tmdbVotes={d.tmdbVotes} />
              <YourRating title={core} />
            </div>
            {d.overview && (
              <div className="mt-4 max-md:order-4">
                <ExpandableText text={d.overview} lines={3} label={t("titlePage.readOverview")} className="text-body-l text-text-1" />
              </div>
            )}
            <div className="mt-6 max-md:order-3 max-md:mt-5">
              <TitleActions title={core} />
            </div>
          </div>
          {credits}
        </div>
      </div>
    </header>
  );
}
