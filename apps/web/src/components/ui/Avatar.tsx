import type { AvatarColor } from "@lumovio/contracts";
import { clsx } from "clsx";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { AvatarPhoto } from "./AvatarPhoto";
import { cn } from "./cn";
import { groupFocusRing } from "./styles";

/**
 * Profile avatars (design-system 7.17, the owner's choice of 2026-11-06): the profile's own photo, or one of twelve
 * colours with the name's first letter. The colours are the avatar palette `--avatar-*` in globals.css (3.6): hues far
 * enough apart to tell profiles apart at 32 px (PRF-20); the photo lies on its colour, which shows while it loads.
 * Keyed by every contracts `AvatarColor` (the type checks none is missing), so the editor takes its list from here:
 * importing the `AVATARS` value from @lumovio/contracts would bring zod into the page (≈ 30 KB gzip).
 */
const AVATAR_BACKGROUND: Record<AvatarColor, string> = {
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

/** Every colour, in the editor's order (around the colour wheel). */
export const AVATAR_COLORS = Object.keys(AVATAR_BACKGROUND) as AvatarColor[];

/**
 * An avatar value's colour. A value with a drawn mark after a dot (saved before 2026-11-06) reads as its colour, and an
 * unknown one as the default colour, so any value still draws.
 */
export function avatarColor(avatar: string): AvatarColor {
  const c = avatar.split(".")[0];
  return c && c in AVATAR_BACKGROUND ? (c as AvatarColor) : "aurora";
}

/**
 * A profile's circle: its photo, or its colour with the name's first letter. Without a photo and a name (an editor
 * before anything is typed) it is the colour alone, never a "?" (PRF-09, PRF-20). Decorative: the name always stands
 * next to it. `size` in px, or a CSS length (the TV shell's are in rem, 10.3).
 */
export function ProfileAvatar({
  avatar,
  photo,
  name,
  size = 40,
  className,
}: {
  avatar: string;
  /** The profile's photo (`Profile.photo`); null or left out — the letter. */
  photo?: string | null;
  name: string;
  size?: number | string;
  className?: string;
}) {
  const initial = [...name.trim()][0]?.toUpperCase();
  const scaled = (k: number) => (typeof size === "number" ? size * k : `calc(${size} * ${k})`);
  const letter = initial ? <span className="drop-shadow-sm/35">{initial}</span> : null;
  return (
    <span
      aria-hidden
      // Top-aligned in a line: a photo has no text baseline, and its circle would stand a descender higher than a letter's.
      className={clsx("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-avatar align-top font-extrabold text-white shadow-inner", className)}
      style={{ width: size, height: size, background: AVATAR_BACKGROUND[avatarColor(avatar)], fontSize: scaled(0.42) }}
    >
      {photo ? <AvatarPhoto src={photo} fallback={letter} /> : letter}
    </span>
  );
}

export interface AvatarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  avatar: string;
  photo?: string | null;
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
  { avatar, photo, name, before, className, type = "button", ...rest },
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
        photo={photo}
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
