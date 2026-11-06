"use client";

import type { FeaturedTitle, Genre } from "@lumovio/contracts";
import { clsx } from "clsx";
import { Pause } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { usePlayable } from "@/hooks/useAvailability";
import { capitalize } from "@/lib/format";
import { BACKDROP_SIZES, backdropSrcSet, preloadBackdrop, tmdbImage } from "@/lib/images";
import { afterPageLoad } from "@/lib/page-load";
import { rotates, SlideClock } from "@/lib/rotation";
import { CardRating } from "./CardRating";
import { HeroActions } from "./HeroActions";
import { TitleLogo } from "./TitleLogo";

const INTERVAL_MS = 8000;

/**
 * The billboard of the home page and the catalog sections (design-system 7.14): full-bleed artwork on the stage (3.5,
 * dark in either theme), the title's logo or name, one metadata line (rating · year · type · genres), three lines of
 * overview (not on a phone), and the actions of 8.2 (./HeroActions: "Watch" where a copy plays, else "More info", HOME-02).
 *
 * Rotation: a new slide every 8 s; a mouse over it, keyboard focus inside, a hidden tab or the pause button hold the
 * current one where it is (its time and its progress segment are kept), and reduced motion turns it off. The pause
 * button (a toggle with the pause icon, never a ▶ that reads as "Watch", HOME-12) and the progress segments sit at the
 * end of the actions' row, 44 px to tap on a phone; the segments are one Tab stop, ←/→ move between slides.
 *
 * Phone: a 2:1 band of art under the header, the text and buttons under it on the stage, so the next shelf starts in
 * the first screen. `under="header"` (home) puts the stage under the transparent header and marks the page as opening
 * on art (`data-hero`). `section` (a catalog section) is the same billboard inside the section's stage, which lies under
 * the header and lays the section's name and controls over the top of the art (browse/SectionLanding, owner 2026-10-25):
 * its top scrim is deeper for them, and on a phone its band of art starts under the header and is taller, with room for
 * them over it.
 */
export function Billboard({ items, genres, under = "header" }: { items: FeaturedTitle[]; genres: Genre[]; under?: "header" | "section" }) {
  const t = useTranslations();
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const segments = useRef<(HTMLButtonElement | null)[]>([]);
  const [clock] = useState(() => new SlideClock(INTERVAL_MS));
  const slide = useRef(index);
  // "Watch" only where something can actually play; otherwise the details page is the main action.
  const playable = usePlayable(items.map((f) => f.id));
  // The next slide's art is fetched once the page has loaded, not beside the first slide's (the largest image of the
  // first screen) on a slow network.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => afterPageLoad(() => setLoaded(true)), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(mq.matches);
    const visibility = () => setHidden(document.visibilityState === "hidden");
    motion();
    visibility();
    mq.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mq.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const running = rotates(items.length, { paused, hover, focus, hidden, reduced });
  useEffect(() => {
    if (slide.current !== index) {
      slide.current = index;
      clock.reset();
    }
    // The bar is a compositor animation placed at the slide clock's time, so it costs the main thread
    // nothing per frame (painting it from requestAnimationFrame kept the whole page re-compositing
    // every frame, even scrolled away). Held, it stops where it is.
    const progress = bar.current?.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: INTERVAL_MS,
      fill: "forwards",
    });
    if (progress) progress.currentTime = clock.shown(performance.now());
    if (!running) {
      progress?.pause();
      return () => progress?.cancel();
    }
    clock.resume(performance.now());
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % items.length), clock.remaining(performance.now()));
    return () => {
      window.clearTimeout(timer);
      clock.pause(performance.now());
      progress?.cancel();
    };
  }, [running, index, items.length, clock]);

  // Choosing the slide already shown keeps its time; another slide starts its own interval.
  const go = useCallback((i: number) => setIndex(((i % items.length) + items.length) % items.length), [items.length]);
  // The segments are one stop: ←/→ (Home/End) choose the slide and keep the focus on its segment.
  const onSegmentKey = (e: KeyboardEvent) => {
    const rtl = root.current ? getComputedStyle(root.current).direction === "rtl" : false;
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : step ? index + (rtl ? -step : step) : null;
    if (to === null) return;
    e.preventDefault();
    const next = ((to % items.length) + items.length) % items.length;
    go(next);
    segments.current[next]?.focus();
  };
  const genreName = (id: number) => {
    const name = genres.find((g) => g.id === id)?.name;
    return name ? capitalize(name, locale) : undefined;
  };
  const item = items[index];
  if (!item) return null;
  const hero = under === "header";
  const section = under === "section";

  // The first slide's art is the page's largest paint: fetched from the head, not when its <img> is reached.
  preloadBackdrop(items[0]?.backdropPath);
  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label={t("home.featured")}
      onPointerEnter={(e) => e.pointerType !== "touch" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      // Keyboard focus holds the slide; a tap on a phone does not freeze the rotation.
      onFocusCapture={(e) => (e.target as HTMLElement).matches(":focus-visible") && setFocus(true)}
      onBlurCapture={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
      data-hero={hero ? "" : undefined}
      className={clsx(
        "relative isolate overflow-hidden bg-stage",
        // Home: under the transparent header; a phone's band of art starts below it. A section: its stage is under it.
        hero && "-mt-16 max-md:pt-16",
        // At least 88 % of the screen; taller when the text needs it (a phone held sideways, a two-line logo) — it never
        // goes up under the header or the section's own row (owner, 2026-10-30).
        "md:flex md:min-h-[max(88svh,37.5rem)] md:flex-col",
      )}
    >
      {/* The art: a 2:1 band in the flow on a phone, the whole billboard from a tablet. */}
      <div className={clsx("relative -z-20 aspect-2/1 md:absolute md:inset-0 md:aspect-auto", section && "max-md:aspect-auto max-md:h-[calc(4rem+62.5vw)]")}>
        {items.map((f, i) => {
          const near = i === index || (loaded && i === (index + 1) % items.length);
          return (
            <div key={f.id} aria-hidden={i !== index} className={clsx("absolute inset-0 transition-opacity duration-scene ease-scene", i === index ? "opacity-100" : "opacity-0")}>
              {near && f.backdropPath && (
                <img
                  src={tmdbImage(f.backdropPath, "w1280") ?? undefined}
                  srcSet={backdropSrcSet(f.backdropPath)}
                  sizes={BACKDROP_SIZES}
                  alt=""
                  fetchPriority={i === 0 ? "high" : "low"}
                  className="size-full object-cover object-[50%_30%] md:object-[50%_22%]"
                />
              )}
            </div>
          );
        })}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-stage to-transparent md:hidden" />
      </div>
      {/* Scrims: header legibility, the text column (--scrim-start: what keeps a logo or a name legible, with no glow
          around it), and the hand-off into the page. Always dark over artwork (3.5). */}
      {hero && <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-stage/70 to-transparent max-md:hidden" />}
      {section && <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-48 bg-linear-to-b from-stage/90 via-stage/60 to-transparent md:h-64" />}
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-stage/92 via-stage/55 via-45% to-transparent to-75% max-md:hidden rtl:bg-linear-to-l" />
      {/* Dark theme: into the page, where the first shelf comes up onto it; light theme: an even dark edge (3.5, X-27). */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[62%] bg-linear-to-t from-bg via-stage/55 to-transparent max-md:hidden in-data-[theme=light]:from-stage" />

      <div
        className={clsx(
          "stage page-x relative mx-auto flex max-w-media flex-col pb-6 md:w-full md:flex-1 md:justify-end md:pb-16 md:in-data-[theme=dark]:pb-44",
          // Room for the header above the text (and the section's title row under it).
          hero ? "md:pt-[calc(var(--header-h)+2rem)]" : section && "md:pt-[calc(var(--header-h)+6rem)]",
        )}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
          <div key={item.id} aria-roledescription="slide" aria-label={`${index + 1} / ${items.length}: ${item.title}`} className="flex max-w-[38.75rem] animate-fade-up flex-col items-center text-center md:items-start md:text-start">
            {item.logo ? (
              <h2 className="w-full">
                <TitleLogo
                  logo={item.logo}
                  alt={item.title}
                  className={clsx(
                    "mx-auto max-w-[78vw] object-contain md:mx-0 md:max-w-[28.75rem]",
                    // The logo's height limit (TitleLogo); a wide one lower.
                    item.logo.aspectRatio > 3.2 ? "[--logo-h:5rem] md:[--logo-h:7.5rem]" : "[--logo-h:6rem] md:[--logo-h:10rem]",
                  )}
                >
                  <span className="block text-balance text-display">{item.title}</span>
                </TitleLogo>
              </h2>
            ) : (
              <h2 className="text-balance text-display">{item.title}</h2>
            )}
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-body-s font-semibold text-text-1 md:mt-5 md:justify-start md:text-body">
              {[
                item.lumovioScore || item.imdbRating || item.tmdbRating ? <CardRating key="r" title={item} /> : null,
                item.year,
                item.isAnime ? t("common.anime") : item.kind === "movie" ? t("common.movie") : t("common.series"),
                ...item.genreIds.map(genreName).filter(Boolean).slice(0, 2),
              ]
                .filter((x) => x !== null && x !== undefined)
                // The "·" ends the part before it, so a wrapped line never starts with one.
                .map((x, i, all) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed order of parts
                  <span key={i} className={i < all.length - 1 ? "after:ms-2 after:content-['·']" : undefined}>
                    {x}
                  </span>
                ))}
            </p>
            {item.overview && <p className="mt-3 line-clamp-3 max-w-140 text-body-l text-text-1 max-md:hidden">{item.overview}</p>}
            <HeroActions title={item} playable={playable.data ? Boolean(playable.data[item.id]) : undefined} className="mt-5 max-w-[26.25rem] md:mt-6 md:max-w-none" />
          </div>

          {items.length > 1 && (
            // Centred under the centred text and buttons on a phone, bottom right next to them from md (7.14).
            <div className="flex items-center justify-center gap-1 md:shrink-0 md:justify-end">
              {!reduced && <IconButton icon={Pause} variant="stage" size="sm" pressed={paused} label={t("home.pauseRotation")} onClick={() => setPaused((p) => !p)} />}
              {/* biome-ignore lint/a11y/useSemanticElements: a group of carousel controls, not a form's fieldset */}
              <div role="group" aria-label={t("home.slides")} className="flex items-center">
                {items.map((f, i) => (
                  // A segment of the rotation's progress, not an action of its own: no Button look (explained exception, 7.14).
                  <button /* ui-lint-ignore raw-button: a progress segment of the rotation, 7.14 */
                    key={f.id}
                    ref={(el) => {
                      segments.current[i] = el;
                    }}
                    type="button"
                    tabIndex={i === index ? 0 : -1}
                    onClick={() => i !== index && go(i)}
                    onKeyDown={onSegmentKey}
                    aria-label={t("home.slide", { n: i + 1, total: items.length, title: f.title })}
                    aria-current={i === index}
                    className="group/seg relative h-11 w-11 rounded-xs md:h-8 md:w-10"
                  >
                    <span className="absolute inset-x-1 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-text-1/30 transition-colors duration-fast ease-fast group-hover/seg:bg-text-1/50">
                      {/* The shown slide's progress, from the slide clock; it stays put while held. With reduced motion it marks the current slide. */}
                      {i === index && (
                        <span ref={reduced ? undefined : bar} className="absolute inset-0 rounded-full bg-text-1 ltr:origin-left rtl:origin-right" style={{ transform: reduced ? "none" : "scaleX(0)" }} />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
