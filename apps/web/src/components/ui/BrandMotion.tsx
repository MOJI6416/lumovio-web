import {
  CHECK_PATH,
  INTRO_BEAM_PATH,
  LOADER_BEAM_PATH,
  MARK_PATHS,
  MOTION_ACTION_PATHS,
  WORDMARK_PATH,
} from "@/lib/brand";
import { cn } from "./cn";

/*
 * Light motion (design-system 6.3.1): the kit's vectors drawn inline with its own CSS (brand/motion/motion.css, in
 * globals.css), so they need no request, take the theme's colours (--brand-mark: lime on dark and on a stage, ink on
 * light) and stand still at their final frame with reduced motion. Decorative: whatever shows them says what happens.
 */

const MARK = MARK_PATHS.map((d, i) => <path key={d} className={i ? "lm-screen" : "lm-projector"} d={d} />);

const LOADER_SIZE = { md: "size-12", lg: "size-16" } as const;

/**
 * The loader: light passes from the projector to the screen, 1.6 s, looped. Where a page or a stream is awaited (route
 * loading, the player); a button's own action keeps its small spinner (7.1). `md` 48, `lg` 64 — rem, so larger on a TV.
 */
export function BrandLoader({
  size = "md",
  className,
}: {
  size?: keyof typeof LOADER_SIZE;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 128 128"
      className={cn("lm-art lm-loader shrink-0", LOADER_SIZE[size], className)}
    >
      <g className="lm-mark">{MARK}</g>
      <path className="lm-beam" d={LOADER_BEAM_PATH} />
    </svg>
  );
}

/**
 * The intro: the projector lights up, opens its screen and reveals the wordmark (2.4 s), ending on the logo. Only on a
 * stage, only while the first page of a visit loads (RouteLoading); if it is still loading then, the mark breathes on
 * as the loader does (`.boot`, globals.css).
 */
export function BrandIntro({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="-96 -90 683 292" className={cn("lm-art lm-splash", className)}>
      <defs>
        <clipPath id="lm-intro-reveal">
          <rect className="lm-word-reveal" x="130" y="0" width="365" height="112" />
        </clipPath>
        <linearGradient id="lm-intro-light">
          <stop style={{ stopColor: "var(--lm-mark)" }} stopOpacity=".7" />
          <stop offset="1" style={{ stopColor: "var(--lm-mark)" }} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="lm-mark-move">
        <path className="lm-light" d={INTRO_BEAM_PATH} fill="url(#lm-intro-light)" />
        <g className="lm-mark" transform="scale(.875)">
          {MARK}
        </g>
      </g>
      <g clipPath="url(#lm-intro-reveal)">
        <path className="lm-type" d={WORDMARK_PATH} />
      </g>
    </svg>
  );
}

const CHECK_SIZE = { sm: "size-4", md: "size-5" } as const;
// The kit's tick is drawn for 64 px (a 3 px line); at an icon's size it keeps an icon's line, ~1.7 px (6.4).
const CHECK_STROKE = { sm: 6.8, md: 5.4 } as const;

/**
 * The confirmation: a --success tick draws itself in a soft ring (320 ms, once), where a status icon would be — only
 * once the server has confirmed (8.3): a success toast, "Saved" of a settings section, a finished step.
 */
export function SavedCheck({
  size = "md",
  className,
}: {
  size?: keyof typeof CHECK_SIZE;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      className={cn("lm-art lm-saved shrink-0", CHECK_SIZE[size], className)}
    >
      <circle className="lm-check-ring" cx="32" cy="32" r="27" fill="currentColor" fillOpacity=".12" />
      <path
        className="lm-check"
        d={CHECK_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={CHECK_STROKE[size]}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  );
}

export type ActionMarkKind = keyof typeof MOTION_ACTION_PATHS;

/**
 * A personal action confirmed (6.3.1): the heart of Favourites, the thumb of "Like", the star of a rating — Lucide's own
 * shapes — settle, draw and fill once (280 / 240 / 320 ms), only after the server has said yes (8.3). In the kit's
 * colours (lime on dark, ink on light) where it stands alone, as in a toast; `text-current` takes a button's. `drawn`:
 * the outline was already on the screen (a button's icon), so only the fill and the settle play.
 */
export function ActionMark({
  kind,
  drawn,
  className,
}: {
  kind: ActionMarkKind;
  drawn?: boolean;
  className?: string;
}) {
  const [shape] = MOTION_ACTION_PATHS[kind];
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      data-drawn={drawn || undefined}
      className={cn("lm-art lm-action shrink-0", `lm-${kind}`, "size-5", className)}
    >
      <g className="lm-action-glyph">
        <path className="lm-action-fill" d={shape} fill="currentColor" />
        {MOTION_ACTION_PATHS[kind].map((d) => (
          <path
            key={d}
            className="lm-action-outline"
            d={d}
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  );
}
