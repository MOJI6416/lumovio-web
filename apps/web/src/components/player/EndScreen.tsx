"use client";

import type { TitleSummary } from "@lumovio/contracts";
import { CircleAlert, Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { SavedCheck } from "@/components/ui/BrandMotion";
import { Button, buttonClass } from "@/components/ui/Button";
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

/**
 * The end of a film (design-system 11.1, PLR-04): instead of a black frame with the paused controls — "Watch again",
 * "To the film", whether it went into the history (said, with Retry when it didn't), and a few titles like it. The
 * focus goes to "Watch again"; Space, arrows and the shortcuts stand down while it shows.
 */
export function EndScreen({ end, title, onReplay }: { end: EndInfo; title: string; onReplay: () => void }) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    again.current?.focus({ preventScroll: true });
  }, []);
  const related = end.related.filter((r) => r.posterPath).slice(0, 6);
  return (
    <section aria-labelledby="end-h" className="pointer-events-auto absolute inset-0 z-10 overflow-y-auto bg-stage/90 backdrop-blur in-data-[tv=1]:backdrop-blur-none">
      <div className="mx-auto flex min-h-full w-full max-w-tool flex-col justify-center gap-8 p-4 pt-[max(24px,env(safe-area-inset-top))] md:p-12">
        <div className="flex flex-col gap-3">
          <h2 id="end-h" className="text-h2 text-text-1">
            {t("endTitle", { title })}
          </h2>
          {end.marked && (
            <p className="flex items-center gap-2 text-body text-text-2" aria-live="polite">
              {end.marked === "pending" ? (
                <Loader2 aria-hidden className="size-5 animate-spin" />
              ) : end.marked === "done" ? (
                <SavedCheck />
              ) : (
                <CircleAlert aria-hidden className="size-5 text-danger" />
              )}
              {end.marked === "pending" ? t("endMarking") : end.marked === "done" ? t(end.kind === "movie" ? "endMarkedMovie" : "endMarkedEpisode") : t("endMarkFailed")}
              {end.marked === "failed" && (
                <Button variant="tertiary" size="sm" onClick={end.onRetryMark}>
                  {tc("retry")}
                </Button>
              )}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 max-sm:flex-col">
            <Button ref={again} size="lg" icon={RotateCcw} onClick={onReplay}>
              {t("watchAgain")}
            </Button>
            <Link href={end.titleHref} className={buttonClass("secondary", "lg")}>
              {t(end.kind === "movie" ? "toFilm" : "toSeries")}
            </Link>
          </div>
        </div>
        {related.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-h3 text-text-1">{t("endMoreLike")}</h3>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {related.map((r) => (
                <li key={r.id}>
                  <Link href={titleHref(r.kind, r.tmdbId, r.title)} className="group flex flex-col gap-2 rounded-sm">
                    <img src={tmdbImage(r.posterPath, "w185") ?? undefined} alt="" loading="lazy" className="aspect-2/3 w-full rounded-sm bg-surface-2 object-cover" />
                    <span className="line-clamp-2 text-body-s text-text-1">{r.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
