import type { AvatarId } from "@lumovio/contracts";
import { clsx } from "clsx";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "./cn";
import { groupFocusRing } from "./styles";

/**
 * Designed gradient avatars (no user-uploaded images → nothing to moderate, nothing to leak). The colours are the
 * avatar palette `--avatar-*` in globals.css (design-system 3.6, 7.17): twelve hues far enough apart to tell profiles
 * apart at 32 px (PRF-20). Keyed by every contracts `AvatarId` (the type checks none is missing), so the picker takes
 * its list from here: importing the `AVATARS` value from @lumovio/contracts would bring zod into the page (≈ 30 KB gzip).
 */
const AVATAR_BACKGROUND: Record<AvatarId, string> = {
  ember: "var(--avatar-ember)",
  comet: "var(--avatar-comet)",
  nova: "var(--avatar-nova)",
  moss: "var(--avatar-moss)",
  prism: "var(--avatar-prism)",
  tide: "var(--avatar-tide)",
  aurora: "var(--avatar-aurora)",
  lumen: "var(--avatar-lumen)",
  orbit: "var(--avatar-orbit)",
  dusk: "var(--avatar-dusk)",
  bloom: "var(--avatar-bloom)",
  coral: "var(--avatar-coral)",
};

/** Every avatar, in the picker's order (around the colour wheel). */
export const AVATAR_IDS = Object.keys(AVATAR_BACKGROUND) as AvatarId[];

/** The avatar's fill (the default one for an unknown id). */
const avatarBackground = (avatar: string) => AVATAR_BACKGROUND[avatar as AvatarId] ?? AVATAR_BACKGROUND.aurora;

/**
 * A profile's squircle with its initial. Without a name (an editor before anything is typed) it is the colour alone,
 * never a "?" (PRF-09, PRF-20). Decorative: the name always stands next to it. `size` in px, or a CSS length (the TV
 * shell's are in rem, 10.3).
 */
export function ProfileAvatar({ avatar, name, size = 40, className }: { avatar: string; name: string; size?: number | string; className?: string }) {
  const initial = [...name.trim()][0]?.toUpperCase();
  return (
    <span
      aria-hidden
      className={clsx("inline-grid shrink-0 place-items-center rounded-avatar font-extrabold text-white shadow-inner", className)}
      style={{ width: size, height: size, background: avatarBackground(avatar), fontSize: typeof size === "number" ? size * 0.42 : `calc(${size} * 0.42)` }}
    >
      {initial && <span className="drop-shadow-sm/35">{initial}</span>}
    </span>
  );
}

export interface AvatarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  avatar: string;
  name: string;
  /** Before the avatar: the kids profile's Tag (8.10). */
  before?: ReactNode;
}

/**
 * The header's account button (7.17, 7.19): the profile's 32 px avatar itself, nothing after it, so it stands on the
 * page's end edge as the logo stands on its start edge (owner, 2026-10-25). Hover and an open menu ring the avatar
 * with --line-2 (as a card, 6.3); the keyboard's ring goes round the avatar too — the button is wider than it, with
 * the avatar at its end, so a ring round the button stood off-centre. 40 px tall (44 on a phone, the avatar at its
 * end; 48 on a TV). The accessible name comes with `aria-label`.
 */
export const AvatarButton = forwardRef<HTMLButtonElement, AvatarButtonProps>(function AvatarButton(
  { avatar, name, before, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "group inline-flex h-10 min-w-10 shrink-0 select-none items-center justify-end gap-2 rounded-sm focus-visible:outline-none focus-visible:shadow-none max-sm:h-11 max-sm:min-w-11 in-data-[tv=1]:h-12",
        className,
      )}
      {...rest}
    >
      {before}
      <ProfileAvatar
        avatar={avatar}
        name={name}
        size={32}
        className={cn(
          "transition-shadow duration-fast ease-fast group-hover:ring-2 group-hover:ring-line-2 group-data-[state=open]:ring-2 group-data-[state=open]:ring-line-2",
          groupFocusRing,
        )}
      />
    </button>
  );
});
