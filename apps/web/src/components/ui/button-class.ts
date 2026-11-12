import { cn } from "./cn";

// A button's classes apart from the Button component, so a server page that only styles a link (the 404, maintenance)
// doesn't import lucide-react's client Icon through Button's spinner — that alone gave the maintenance page 172 KB of JS.

/** One `primary` per area; `danger` only confirms a deletion in a dialog. */
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "danger-tertiary";
export type ButtonSize = "sm" | "md" | "lg";
/**
 * `stacked`: below md the icon (24) stands over a 12 px caption, without the fill and border — one of a row of
 * labelled actions sharing the width (the title's Watchlist · Rate · More); from md it is the plain button.
 */
export type ButtonLayout = "inline" | "stacked";

// Roles only, so the colours follow the theme and `.stage`: primary is white on dark and black on light.
// `danger` carries dark text in the dark theme: white on the light red is 2.8:1.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-text-1 text-bg hover:not-disabled:bg-text-1/85",
  secondary: "border border-line-2 bg-surface-2 text-text-1 hover:not-disabled:bg-surface-3",
  tertiary: "text-text-1 hover:not-disabled:bg-surface-2",
  danger: "bg-danger text-bg hover:not-disabled:bg-danger/85",
  "danger-tertiary": "text-danger hover:not-disabled:bg-danger-soft",
};

// On a phone every button is at least 44 px; `sm` exists for dense desktop panels only. On a TV every size is
// lg (48 rem-px, 66 at the TV's scale: a remote's target is 64, text at least body) — callers don't pass it.
const TV_LG = "in-data-[tv=1]:h-12 in-data-[tv=1]:min-w-12 in-data-[tv=1]:px-6 in-data-[tv=1]:text-body";
const SIZES: Record<ButtonSize, string> = {
  sm: `h-8 px-3 text-body-s max-sm:h-11 max-sm:min-w-11 [&_svg:not([class*=size-])]:size-4 ${TV_LG}`,
  md: `h-10 px-4 text-body max-sm:h-11 max-sm:min-w-11 [&_svg:not([class*=size-])]:size-5 ${TV_LG}`,
  lg: "h-12 min-w-12 px-6 text-body [&_svg:not([class*=size-])]:size-5",
};

export const ICON_SIZE: Record<ButtonSize, string> = { sm: "size-4 in-data-[tv=1]:size-5", md: "size-5", lg: "size-5" };

const LAYOUTS: Record<ButtonLayout, string> = {
  inline: "",
  stacked:
    "max-md:h-auto max-md:min-h-14 max-md:min-w-0 max-md:flex-1 max-md:basis-0 max-md:flex-col max-md:gap-1 max-md:whitespace-normal max-md:border-transparent max-md:bg-transparent max-md:px-1 max-md:py-1.5 max-md:text-caption max-md:leading-tight max-md:[&_svg]:size-6",
};

const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,opacity,scale] duration-fast ease-fast active:not-disabled:scale-98 disabled:opacity-40 [&_svg]:shrink-0";

/**
 * Classes of a button, for links that look like one (`<Link className={buttonClass("secondary")}>`). `extra` is for
 * placement only (margins, width, `grow`); colour and size come from the variant and size.
 */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
  layout: ButtonLayout = "inline",
) {
  return cn(BASE, VARIANTS[variant], SIZES[size], LAYOUTS[layout], extra);
}
