import { LOGO_HEIGHT, LOGO_WIDTH, MARK_PATHS, WORDMARK_PATH } from "@/lib/brand";

/** The mark's own width in the lockup's units (its paths end at x 124, drawn at 0.875). */
const MARK_WIDTH = 110;

/**
 * Shared vector lockup, one size everywhere — header, footer, sign-in, "Who's watching?", system pages (SH-15): 30 px
 * high in rem, so it scales with the TV root size (10.3). The word inherits the text colour; the mark is --brand-mark
 * (lime on dark and on the stage, ink on light).
 *
 * `compact`: from md to lg (768–1023) only the mark, at the same height — the header's sections then fit beside it in
 * every language, with a kids profile's tag (design-system 7.19). The accessible name stays "Lumovio".
 */
export function Wordmark({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-block shrink-0 align-middle ${className}`}>
      <svg role="img" aria-label="Lumovio" viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`} className={`block h-7.5 w-auto ${compact ? "md:max-lg:hidden" : ""}`}>
        <title>Lumovio</title>
        <g transform="scale(.875)" fill="var(--brand-mark)">
          {MARK_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <path fill="currentColor" d={WORDMARK_PATH} />
      </svg>
      {compact && (
        <svg aria-hidden viewBox={`0 0 ${MARK_WIDTH} ${LOGO_HEIGHT}`} className="hidden h-7.5 w-auto md:max-lg:block">
          <g transform="scale(.875)" fill="var(--brand-mark)">
            {MARK_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </svg>
      )}
    </span>
  );
}
