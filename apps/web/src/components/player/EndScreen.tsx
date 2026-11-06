"use client";

import type { TitleLogoArt, TitleSummary } from "@lumovio/contracts";
import { ArrowLeft, CircleAlert, Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";
import { TitleLogo } from "@/components/media/TitleLogo";
import { SavedCheck } from "@/components/ui/BrandMotion";
import { Button, buttonClass } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Link } from "@/i18n/navigation";
import { tmdbImage } from "@/lib/images";
import { titleHref } from "@/lib/slug";

/** What the end of a film or of a series' last episode offers (PLR-04). */
export interface EndInfo {
  /** The title page ("To the film", "To the series"). */
  titleHref: string;
  kind: "movie" | "tv";
  /** Titles like this one (the title page's "More like this"), a few with posters. */
  related: TitleSummary[];
  /** The watch being recorded in the history: under way, recorded, failed (with a retry); null for a guest. */
  marked: "pending" | "done" | "failed" | null;
  onRetryMark: () => void;
}

/** Whether the watch went into the history: under way, recorded (the brand's check), failed with Retry. */
export function Marked({ end }: { end: EndInfo }) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  if (!end.marked) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-body text-text-2" aria-live="polite">
      {end.marked === "pending" ? <Loader2 aria-hidden className="size-5 animate-spin" /> : end.marked === "done" ? <SavedCheck /> : <CircleAlert aria-hidden className="size-5 text-danger" />}
      {end.marked === "pending" ? t("endMarking") : end.marked === "done" ? t(end.kind === "movie" ? "endMarkedMovie" : "endMarkedEpisode") : t("endMarkFailed")}
      {end.marked === "failed" && (
        <Button variant="tertiary" size="sm" onClick={end.onRetryMark}>
          {tc("retry")}
        </Button>
      )}
    </p>
  );
}

/**
 * The end of a film or of a series' last episode on the site (design-system 11.1, PLR-04): the title's art, its logo
 * (or name) as the heading, whether the watch went into the history, the way to the title page — the main action, the
 * focus on it — "Watch again", and titles like it as a shelf without captions (7.12: the name over the poster on hover
 * and focus). "←" stays where it is in the player. Space, arrows and the shortcuts stand down while it shows.
 */
export function EndScreen({ end, title, logo, backdrop, onReplay, onBack }: { end: EndInfo; title: string; logo: TitleLogoArt | null; backdrop: string | null; onReplay: () => void; onBack: () => void }) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const main = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
  }, []);
  const related = end.related.filter((r) => r.posterPath).slice(0, 6);
  const heading = t("endTitle", { title });
  return (
    <section aria-label={heading} className="pointer-events-auto absolute inset-0 z-10 overflow-y-auto bg-stage" data-interactive>
      {backdrop && <img src={backdrop} alt="" className="absolute inset-0 size-full object-cover opacity-45" />}
      <div aria-hidden className="absolute inset-0 bg-linear-to-t from-stage via-stage/75 to-stage/10" />
      <div className="absolute start-4 top-[max(1rem,env(safe-area-inset-top))] z-10 md:start-8 md:top-8">
        <IconButton icon={ArrowLeft} label={tc("back")} variant="stage" size="lg" onClick={onBack} className="[&_svg]:rtl:-scale-x-100" />
      </div>
      <div className="relative flex min-h-full flex-col justify-end gap-8 px-4 pt-24 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-10 md:pb-12">
        <div className="flex max-w-2xl flex-col items-start gap-4">
          <h2 className="text-h1 text-text-1">
            {logo ? (
              <TitleLogo logo={logo} alt={heading} className="max-w-[min(80vw,28rem)] [--logo-h:5rem] md:[--logo-h:7rem]">
                {heading}
              </TitleLogo>
            ) : (
              heading
            )}
          </h2>
          <Marked end={end} />
          <div className="mt-2 flex flex-wrap gap-3 max-sm:w-full max-sm:flex-col">
            <Link ref={main} href={end.titleHref} className={buttonClass("primary", "lg")}>
              {t(end.kind === "movie" ? "toFilm" : "toSeries")}
            </Link>
            <Button variant="secondary" size="lg" icon={RotateCcw} onClick={onReplay}>
              {t("watchAgain")}
            </Button>
          </div>
        </div>
        {related.length > 0 && (
          <section aria-labelledby="end-more" className="flex flex-col gap-3">
            <h3 id="end-more" className="text-h3 text-text-1">
              {t("endMoreLike")}
            </h3>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6 md:gap-4">
              {related.map((r) => (
                <li key={r.id}>
                  <Poster title={r} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}

/** A poster of the end screen's shelf: the name over its foot on hover and focus only (7.12), and always for the reader. */
function Poster({ title: r }: { title: TitleSummary }): ReactNode {
  return (
    <Link href={titleHref(r.kind, r.tmdbId, r.title)} aria-label={r.title} className="group relative block overflow-hidden rounded-sm">
      <img src={tmdbImage(r.posterPath, "w185") ?? undefined} alt="" loading="lazy" className="aspect-2/3 w-full bg-surface-2 object-cover transition-transform duration-base ease-base group-hover:scale-103" />
      <span aria-hidden className="absolute inset-x-0 bottom-0 bg-linear-to-t from-stage/90 to-transparent px-2 pt-6 pb-2 text-body-s font-semibold text-text-1 opacity-0 transition-opacity duration-fast ease-fast group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="line-clamp-2">{r.title}</span>
      </span>
    </Link>
  );
}
