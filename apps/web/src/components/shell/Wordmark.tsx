import { LOGO_HEIGHT, LOGO_WIDTH, MARK_PATHS, WORDMARK_PATH } from "@/lib/brand";

/**
 * Shared vector lockup, one size everywhere — header, footer, sign-in, "Who's watching?", system pages (SH-15): 30 px
 * high in rem, so it scales with the TV root size (10.3). The word inherits the text colour; the mark is --brand-mark
 * (lime on dark and on the stage, ink on light).
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block shrink-0 align-middle ${className}`}>
      <svg role="img" aria-label="Lumovio" viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`} className="block h-7.5 w-auto">
        <title>Lumovio</title>
        <g transform="scale(.875)" fill="var(--brand-mark)">
          {MARK_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <path fill="currentColor" d={WORDMARK_PATH} />
      </svg>
    </span>
  );
}
