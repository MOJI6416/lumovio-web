"use client";

import type { FeaturedTitle, Genre } from "@lumovio/contracts";
import { clsx } from "clsx";
import { Pause } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type KeyboardEvent, type MouseEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { usePlayable } from "@/hooks/useAvailability";
import { Link } from "@/i18n/navigation";
import { capitalize } from "@/lib/format";
import { BACKDROP_SIZES, backdropSrcSet, preloadBackdrop, tmdbImage } from "@/lib/images";
import { afterPageLoad } from "@/lib/page-load";
import { rotates, SlideClock } from "@/lib/rotation";
import { titleHref } from "@/lib/slug";
import { CardRating } from "./CardRating";
import { HeroActions } from "./HeroActions";
import { TitleLogo } from "./TitleLogo";

const INTERVAL_MS = 8000;
/** How long a slide asked for waits for its art before it is shown anyway (a slow network). */
const WAIT_MS = 2500;
/** A finger's sideways move that turns the slide: this far, and mostly sideways. */
const SWIPE_PX = 48;

/**
 * The billboard of the home page and the catalog sections (design-system 7.14): full-bleed artwork on the stage (3.5,
 * dark in either theme), the title's logo or name, one metadata line (rating · year · type · genres), three lines of
 * overview (not on a phone), and the actions of 8.2 (./HeroActions: "Watch" where a copy plays, else "More info", HOME-02).
 *
 * Rotation: a new slide every 8 s; a mouse over it, keyboard focus inside, a hidden tab or the billboard scrolled mostly
 * away hold the current one where it is (its time and its timer are kept), and reduced motion turns it off. A slide
 * chosen by hand (a dot, ←/→, a swipe) stays, and after one round so does the first: the rotation stops. A new slide
 * fades in over the old one, which stays whole under it (no dip to the stage between two pictures), and only once its
 * art has loaded (at most 2.5 s on a slow network): the neighbours' art is fetched after the page has loaded, every
 * slide's once a pointer or focus reaches the billboard (2026-11-08). The dots sit at the end of the actions' row, the
 * shown slide's one a capsule filling with its time (full once the rotation stops), 44 px to tap on a phone; they are
 * one Tab stop, ←/→ move between slides. No pause button on view (owner, 2026-11-12): the toggle is there for the
 * keyboard and a screen reader, seen while it has focus (WCAG 2.2.2).
 *
 * The art and the title open the title's page (the largest thing on the screen does what "More info" does; the button
 * stays the keyboard's way there), and a finger swiped sideways over the billboard turns the slide.
 *
 * The art is never cut across (7.14, 2026-11-08). A phone, a portrait tablet or a squarish window: a band of art under
 * the header (2:1 on a phone, 16:9 from sm), the text and buttons under it on the stage, so the next shelf starts in
 * the first screen. From md on a screen no taller than 5:4 the art is a whole 16:9 picture on the end side, 80 % of the
 * width, with the text on the stage before it, and the billboard is 88 % of the screen in the dark theme, where the
 * first shelf comes up onto it, and 72 % in the light one, where the stage ends with an even edge: the first shelf is in
 * the first screen in either (2026-11-06; it was under the fold in the light theme). `under="header"` (home) puts the stage under the
 * transparent header and marks the page as opening on art (`data-hero`). `section` (a catalog section) is the same
 * billboard inside the section's stage, which lies under the header and lays the section's name and controls over the
 * top of the art (browse/SectionLanding, 2026-10-25): its top scrim is deeper for them, and on a phone or a portrait
 * tablet its band of art starts under the header and is taller, with room for them over it.
 */
export function Billboard({ items, genres, under = "header" }: { items: FeaturedTitle[]; genres: Genre[]; under?: "header" | "section" }) {
  const t = useTranslations();
  const locale = useLocale();
  // The slide shown and the one before it, which stays drawn under the new one while that fades in (a cross-fade,
  // not a dip to the stage between two pictures: the outgoing art used to leave at once, 2026-11-08).
  const [{ index, prev }, setSlide] = useState<{ index: number; prev: number | null }>({ index: 0, prev: null });
  // A slide asked for whose art hasn't loaded yet: shown once it has (or after WAIT_MS), never as an empty frame.
  const [pending, setPending] = useState<number | null>(null);
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());
  // Someone reached for the carousel (a pointer over it, focus in it): every slide's art is fetched.
  const [warm, setWarm] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const segments = useRef<(HTMLButtonElement | null)[]>([]);
  const [clock] = useState(() => new SlideClock(INTERVAL_MS));
  const slide = useRef(index);
  // Where a finger went down (a swipe turns the slide), and whether the press that ends became a swipe.
  const touch = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiped = useRef(false);
  // "Watch" only where something can actually play; otherwise the details page is the main action.
  const playable = usePlayable(items.map((f) => f.id));
  // The neighbours' art is fetched once the page has loaded, not beside the first slide's (the largest image of the
  // first screen) on a slow network.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => afterPageLoad(() => setLoaded(true)), []);
  const markReady = useCallback((id: string) => setReady((s) => (s.has(id) ? s : new Set(s).add(id))), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(mq.matches);
    const visibility = () => setHidden(document.visibilityState === "hidden");
    motion();
    visibility();
    mq.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    // Scrolled mostly away, the slide holds: back up, the same title is there, and nothing is fetched meanwhile.
    const io = root.current
      ? new IntersectionObserver((seen) => seen[0] && setOffscreen(seen[0].intersectionRatio < 0.35), { threshold: [0, 0.35] })
      : null;
    if (root.current) io?.observe(root.current);
    return () => {
      mq.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
      io?.disconnect();
    };
  }, []);

  const n = items.length;
  // The capsule of the shown slide fills with its time while the rotation may go on; stopped, it is full.
  const timer = !reduced && !paused;
  const show = useCallback((to: number) => {
    setSlide((s) => (s.index === to ? s : { index: to, prev: s.index }));
    setPending(null);
  }, []);
  // Choosing the slide already shown keeps its time; another slide starts its own interval — once its art is there.
  const go = useCallback(
    (i: number) => {
      const to = ((i % n) + n) % n;
      const id = items[to]?.id;
      if (to === index || id === undefined) return setPending(null);
      if (ready.has(id)) show(to);
      else setPending(to);
    },
    [n, items, index, ready, show],
  );
  const goRef = useRef(go);
  goRef.current = go;
  // A slide chosen by hand stays: someone is reading it (the slide shown already, too).
  const choose = (i: number) => {
    setPaused(true);
    go(i);
  };
  useEffect(() => {
    if (pending === null) return;
    const id = items[pending]?.id;
    if (id !== undefined && ready.has(id)) return show(pending);
    const timer = window.setTimeout(() => show(pending), WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [pending, ready, items, show]);

  const running = rotates(n, { paused, hover, focus, hidden, offscreen, reduced });
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
    // One round on its own (as Apple TV's and Prime Video's): after the last slide the first comes back and holds.
    const timer = window.setTimeout(() => {
      if (index + 1 >= n) setPaused(true);
      goRef.current(index + 1);
    }, clock.remaining(performance.now()));
    return () => {
      window.clearTimeout(timer);
      clock.pause(performance.now());
      progress?.cancel();
    };
  }, [running, index, n, clock]);

  // The dots are one stop: ←/→ (Home/End) choose the slide and keep the focus on its dot.
  const onSegmentKey = (e: KeyboardEvent) => {
    const rtl = root.current ? getComputedStyle(root.current).direction === "rtl" : false;
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : step ? index + (rtl ? -step : step) : null;
    if (to === null) return;
    e.preventDefault();
    const next = ((to % items.length) + items.length) % items.length;
    choose(next);
    segments.current[next]?.focus();
  };
  const onPointerDown = (e: PointerEvent) => {
    swiped.current = false;
    touch.current = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: PointerEvent) => {
    const from = touch.current;
    touch.current = null;
    if (!from || from.id !== e.pointerId || items.length < 2) return;
    const dx = e.clientX - from.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(e.clientY - from.y) * 1.5) return;
    const rtl = root.current ? getComputedStyle(root.current).direction === "rtl" : false;
    swiped.current = true;
    // The next slide comes from the side the finger moves away from.
    choose(index + (dx < 0 !== rtl ? 1 : -1));
  };
  // The tap that ends a swipe opens nothing.
  const onClickCapture = (e: MouseEvent) => {
    if (!swiped.current) return;
    swiped.current = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const genreName = (id: number) => {
    const name = genres.find((g) => g.id === id)?.name;
    return name ? capitalize(name, locale) : undefined;
  };
  const item = items[index];
  if (!item) return null;
  const hero = under === "header";
  const section = under === "section";
  const href = titleHref(item.kind, item.tmdbId, item.title);

  // The first slide's art is the page's largest paint: fetched from the head, not when its <img> is reached.
  preloadBackdrop(items[0]?.backdropPath);
  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label={t("home.featured")}
      // A pointer over the billboard or focus in it: someone may choose a slide, so every slide's art is fetched.
      onPointerEnter={(e) => {
        setWarm(true);
        if (e.pointerType !== "touch") setHover(true);
      }}
      onPointerLeave={() => setHover(false)}
      // Keyboard focus holds the slide; a tap on a phone does not freeze the rotation.
      onFocusCapture={(e) => {
        setWarm(true);
        if ((e.target as HTMLElement).matches(":focus-visible")) setFocus(true);
      }}
      onBlurCapture={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        touch.current = null;
      }}
      onClickCapture={onClickCapture}
      data-hero={hero ? "" : undefined}
      className={clsx(
        // A finger's sideways move is the billboard's (a swipe), its up and down the page's; pinch zoom stays.
        "relative isolate touch-pan-y touch-pinch-zoom overflow-hidden bg-stage",
        // Home: under the transparent header; a band of art starts below it. A section: its stage is under it.
        hero && "-mt-16 art-band:pt-16",
        // At least 88 % of the screen; taller when the text needs it (a phone held sideways, a two-line logo) — it never
        // goes up under the header or the section's own row (owner, 2026-10-30). The home's light theme: 72 %, so the
        // first shelf under the even edge is in the first screen too.
        "art-over:flex art-over:min-h-[max(88svh,37.5rem)] art-over:flex-col",
        hero && "art-over:in-data-[theme=light]:min-h-[max(72svh,34rem)]",
      )}
    >
      {/* The art (7.14), never cut across: a band in the flow — 2:1 on a phone, 16:9 from sm — on a phone, a portrait
          tablet or a squarish window; from md on a screen no taller than 5:4, a whole 16:9 picture on the end side, 80 %
          of the billboard's width, its start edge and foot dissolving into the stage the text stands on. It opens the
          title (the keyboard's way there is "More info"). */}
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        aria-label={item.title}
        draggable={false}
        className={clsx(
          "relative -z-20 block aspect-2/1 art-band:sm:aspect-video",
          "art-over:absolute art-over:end-0 art-over:top-0 art-over:aspect-video art-over:w-4/5 art-over:mask-b-from-75% art-over:ltr:mask-l-from-70% art-over:rtl:mask-r-from-70%",
          // A section's band is taller: its name and controls stand over its top (2026-10-25; the owner kept them over
          // the art on 2026-11-08, when they stood above it for a try).
          // Its height and width are set, so a ratio (16:9 from sm) can't widen the band past the screen.
          section && "art-band:aspect-auto art-band:h-[calc(4rem+62.5vw)] art-band:w-full",
        )}
      >
        {items.map((f, i) => {
          // Drawn: the slide shown, the one it replaced (under it while it fades in), one asked for, and once the page
          // has loaded both neighbours (the next one comes on its own, a swipe goes either way); all of them once someone
          // reaches for the carousel.
          const near = i === index || i === prev || i === pending || warm || (loaded && (i === (index + 1) % n || i === (index - 1 + n) % n));
          return (
            <div
              key={f.id}
              aria-hidden={i !== index}
              // The new slide fades in over the old one, which stays whole under it until it is covered (at once with
              // reduced motion).
              className={clsx("absolute inset-0", i === index ? "z-1 opacity-100 transition-opacity duration-scene ease-scene motion-reduce:transition-none" : i === prev ? "opacity-100" : "opacity-0")}
            >
              {near && f.backdropPath && (
                <img
                  // Art already there before the page came alive (the first slide, from the server) has no load event.
                  ref={(el) => {
                    if (el?.complete && el.naturalWidth > 0) markReady(f.id);
                  }}
                  onLoad={() => markReady(f.id)}
                  src={tmdbImage(f.backdropPath, "w1280") ?? undefined}
                  srcSet={backdropSrcSet(f.backdropPath)}
                  sizes={BACKDROP_SIZES}
                  alt=""
                  fetchPriority={i === 0 ? "high" : "low"}
                  draggable={false}
                  // A 2:1 band loses a ninth of a 16:9 picture's height: its foot, where heads aren't.
                  className="size-full object-cover object-[50%_10%]"
                />
              )}
            </div>
          );
        })}
        <div aria-hidden className="absolute inset-x-0 bottom-0 z-2 h-1/3 bg-linear-to-t from-stage to-transparent art-over:hidden" />
      </Link>
      {/* Scrims: header legibility, the text column (--scrim-start: what keeps a logo or a name legible, with no glow
          around it), and the hand-off into the page. Always dark over artwork (3.5). */}
      {/* The scrims and the text column let a press through to the art; the title and the controls take their own. */}
      {hero && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-stage/70 to-transparent art-band:hidden" />}
      {/* A section's name and controls over the top of the art: a deep scrim over a band; beside a 16:9 picture they stand
          mostly on the stage and its dissolving edge, and one a little deeper than the home's is enough (heads at the
          top of the picture stay lit). */}
      {section && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-linear-to-b from-stage/90 via-stage/60 to-transparent art-over:from-stage/80 art-over:via-transparent"
        />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-stage/92 via-stage/55 via-45% to-transparent to-75% art-band:hidden rtl:bg-linear-to-l" />
      {/* Dark theme: into the page, where the first shelf comes up onto it; light theme: an even dark edge (3.5, X-27). */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[62%] bg-linear-to-t from-bg via-stage/55 to-transparent art-band:hidden in-data-[theme=light]:from-stage" />

      <div
        className={clsx(
          "stage page-x pointer-events-none relative mx-auto flex max-w-media flex-col pb-6 art-over:w-full art-over:flex-1 art-over:justify-end art-over:pb-16 art-over:in-data-[theme=dark]:pb-44",
          // Room for the header above the text (and the section's title row under it).
          hero ? "art-over:pt-[calc(var(--header-h)+2rem)]" : section && "art-over:pt-[calc(var(--header-h)+6rem)]",
        )}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
          {/* biome-ignore lint/a11y/useSemanticElements: a carousel's slide is a group (APG carousel), not a form's fieldset */}
          <div key={item.id} role="group" aria-roledescription="slide" aria-label={`${index + 1} / ${items.length}: ${item.title}`} className="flex max-w-[38.75rem] animate-fade-up flex-col items-center text-center md:items-start md:text-start">
            {/* The title opens its page, as the art does (no Tab stop of its own: "More info" is it). */}
            {item.logo ? (
              <h2 className="w-full">
                {/* A wide logo can be under 44 tall on a phone: padding, then the same negative margin (5.6). */}
                <Link href={href} tabIndex={-1} draggable={false} className="pointer-events-auto -my-1.5 block rounded-sm py-1.5">
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
                </Link>
              </h2>
            ) : (
              <h2 className="text-balance text-display">
                {/* At least 44 tall without moving the line (5.6: padding, then the same negative margin). */}
                <Link href={href} tabIndex={-1} draggable={false} className="pointer-events-auto -my-1 inline-block rounded-sm py-1">
                  {item.title}
                </Link>
              </h2>
            )}
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-body-s font-semibold text-text-1 md:mt-5 md:justify-start md:text-body">
              {[
                item.lumovioScore || item.imdbRating || item.tmdbRating ? <CardRating key="r" title={item} /> : null,
                item.year,
                item.isAnime ? t("common.anime") : item.kind === "movie" ? t("common.movie") : t("common.series"),
                ...item.genreIds.map(genreName).filter(Boolean).slice(0, 2),
              ]
                .filter((x) => x !== null && x !== undefined)
                // The "·" ends the part before it, so a wrapped line never starts with one; its empty alt text keeps a
                // screen reader from reading it as a stop of its own.
                .map((x, i, all) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed order of parts
                  <span key={i} className={i < all.length - 1 ? "after:ms-2 after:content-['·'_/_'']" : undefined}>
                    {x}
                  </span>
                ))}
            </p>
            {item.overview && <p className="mt-3 line-clamp-3 max-w-140 text-body-l text-text-1 max-md:hidden">{item.overview}</p>}
            <HeroActions
              title={item}
              playable={playable.data ? Boolean(playable.data[item.id]) : undefined}
              className="pointer-events-auto mt-5 max-w-[26.25rem] md:mt-6 md:max-w-none"
            />
          </div>

          {items.length > 1 && (
            // Centred under the centred text and buttons on a phone, bottom right next to them from md, on their middle (7.14).
            <div className="pointer-events-auto flex items-center justify-center md:h-12 md:shrink-0 md:justify-end">
              {!reduced && (
                <IconButton
                  icon={Pause}
                  variant="stage"
                  size="sm"
                  pressed={paused}
                  label={t("home.pauseRotation")}
                  onClick={() => setPaused((p) => !p)}
                  // Out of the flow and unseen until it has focus (`absolute` over the button's own `relative`).
                  className="absolute sr-only focus-visible:not-sr-only"
                />
              )}
              {/* biome-ignore lint/a11y/useSemanticElements: a group of carousel controls, not a form's fieldset */}
              <div role="group" aria-label={t("home.slides")} className="flex items-center">
                {items.map((f, i) => {
                  const on = i === index;
                  return (
                    // A dot of the carousel, not an action of its own: no Button look (explained exception, 7.14). The
                    // shown slide's dot widens into a capsule and its neighbours move aside, the gaps stay even.
                    <button /* ui-lint-ignore raw-button: a dot of the carousel, 7.14 */
                      key={f.id}
                      ref={(el) => {
                        segments.current[i] = el;
                      }}
                      type="button"
                      tabIndex={on ? 0 : -1}
                      onClick={() => choose(i)}
                      onKeyDown={onSegmentKey}
                      aria-label={t("home.slide", { n: i + 1, total: items.length, title: f.title })}
                      aria-current={on}
                      className={clsx(
                        "group/dot flex h-11 items-center justify-center rounded-full transition-[width] duration-base ease-base motion-reduce:transition-none md:h-8",
                        on ? "w-16 md:w-13" : "w-11 md:w-8",
                      )}
                    >
                      <span
                        className={clsx(
                          "relative h-2 overflow-hidden rounded-full transition-[width,background-color] duration-base ease-base motion-reduce:transition-none",
                          on ? "w-7 bg-text-1/30" : "w-2 bg-text-1/40 group-hover/dot:bg-text-1/75",
                        )}
                      >
                        {/* The shown slide's time, from the slide clock; it stays put while held. */}
                        {on && <span ref={timer ? bar : undefined} className="absolute inset-0 rounded-full bg-text-1 ltr:origin-left rtl:origin-right" style={{ transform: timer ? "scaleX(0)" : "none" }} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
