import { Loader2, type LucideIcon } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../cn";

/*
 * The TV variant of Button and IconButton: 66 px high on a 1920 window (a remote's target
 * is at least 64), text at `body`. At rest every button is the same quiet fill — the main action is the first one and
 * where a screen starts; the focused one turns white with the lime ring and grows a little, so the selection is never in
 * doubt on any art. `round` is the icon-only one (player, "More"), its name in `label`.
 */

export type TvButtonLook = "pill" | "round" | "row";

const LOOKS: Record<TvButtonLook, string> = {
  // A pill as the site's buttons (one family on every screen).
  pill: "h-11 min-w-11 px-5 gap-3 rounded-full",
  round: "size-11 rounded-full [&_svg]:size-6",
  // A full-width line of a list (settings, sources, tracks): label at the start, its value or mark at the end.
  row: "min-h-11 w-full justify-start gap-4 whitespace-normal rounded-sm px-5 py-2 text-start",
};

export function tvButtonClass(look: TvButtonLook = "pill", extra?: string) {
  return cn(
    "tv-focus relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap bg-surface-2 text-body font-semibold text-text-1 disabled:opacity-40 aria-disabled:opacity-40 focus:bg-text-1 focus:text-bg [&_svg]:size-5 [&_svg]:shrink-0",
    LOOKS[look],
    extra,
  );
}

export interface TvButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  look?: TvButtonLook;
  icon?: LucideIcon;
  /** The name of a round button (no visible text). */
  label?: string;
  loading?: boolean;
}

export const TvButton = forwardRef<HTMLButtonElement, TvButtonProps>(function TvButton(
  { look = "pill", icon: Icon, label, loading, className, children, disabled, onClick, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      // A disabled button can't hold the remote's focus: it is "unavailable" with aria-disabled and stays reachable.
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      aria-label={look === "round" ? label : rest["aria-label"]}
      onClick={disabled || loading ? undefined : onClick}
      data-look={look}
      className={tvButtonClass(look, className)}
    >
      {loading ? <Loader2 aria-hidden className="animate-spin" /> : Icon && <Icon aria-hidden />}
      {look !== "round" && children}
    </button>
  );
});
