import type { MediaKind, ScoreConfidence } from "@lumovio/contracts";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { BRAND_LIME, MARK_PATHS } from "@/lib/brand";

/**
 * The approved logo's mark (concept 01, as in the Wordmark lockup) standing for Lumovio's own score.
 * Deliberately not a coloured box or a tomato, so it never reads as another service's score.
 */
export function ScoreMark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 128 128" className={clsx("inline-block size-[1em] shrink-0", className)}>
      <g fill={onDark ? BRAND_LIME : "var(--brand-mark)"}>
        {MARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

/** "Lumovio Score 87 out of 100 — higher than 87% of films. High confidence." */
export function useScoreLabel() {
  const t = useTranslations("score");
  return (score: number, kind: MediaKind, confidence: ScoreConfidence) => t("label", { score, kind, confidence });
}

/** A card's rating: the mark and the number. The mark follows the theme (lime on dark and on a stage, dark on a light page). */
export function ScoreBadge({ score, kind, confidence, className }: { score: number; kind: MediaKind; confidence: ScoreConfidence; className?: string }) {
  const label = useScoreLabel()(score, kind, confidence);
  return (
    // The hint repeats aria-label for a mouse; "All ratings" on the title page explains the score in full.
    <span role="img" aria-label={label} title={label} className={clsx("inline-flex items-baseline gap-1 font-bold tabular-nums", className)}>{/* ui-lint-ignore title-attr: repeats aria-label */}
      {/* The score sits on the line's baseline with the text around it; the mark is centred on the line. */}
      <ScoreMark className="size-[1.05em] self-center" />
      {score}
    </span>
  );
}
