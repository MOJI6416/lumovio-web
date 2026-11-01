import type { AvatarColor, AvatarId, AvatarMark } from "@lumovio/contracts";
import { clsx } from "clsx";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { AVATAR_MARK_IDS, avatarMarkHref } from "./avatar-marks";
import { cn } from "./cn";
import { groupFocusRing } from "./styles";

/**
 * Designed avatars (no user-uploaded images → nothing to moderate, nothing to leak): a colour with a white mark or the
 * name's initial (design-system 7.17, the owner's choice of 2026-11-01). The colours are the avatar palette `--avatar-*`
 * in globals.css (3.6): twelve hues far enough apart to tell profiles apart at 32 px (PRF-20); the marks are
 * ./avatar-marks (one sprite file, drawn by `<use>`). Keyed by every contracts `AvatarColor` (the type checks none is missing), so the picker takes its
 * list from here: importing the `AVATARS` value from @lumovio/contracts would bring zod into the page (≈ 30 KB gzip).
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

/** Every colour, in the picker's order (around the colour wheel). */
export const AVATAR_COLORS = Object.keys(AVATAR_BACKGROUND) as AvatarColor[];

/**
 * An avatar's colour and mark (null: the initial). An unknown colour falls back to the default one and an unknown mark
 * to the initial, so a value from a newer server still draws.
 */
export function avatarParts(avatar: string): { color: AvatarColor; mark: AvatarMark | null } {
  const [c, m] = avatar.split(".");
  const color = c && c in AVATAR_BACKGROUND ? (c as AvatarColor) : "aurora";
  return { color, mark: m && AVATAR_MARK_IDS.includes(m as AvatarMark) ? (m as AvatarMark) : null };
}

/** The value saved for a colour and a mark (null: the initial). */
export const avatarOf = (color: AvatarColor, mark: AvatarMark | null): AvatarId => (mark ? `${color}.${mark}` : color);

/**
 * A profile's squircle with its white mark, or its initial. Without a mark and a name (an editor before anything is
 * typed) it is the colour alone, never a "?" (PRF-09, PRF-20). Decorative: the name always stands next to it. `size` in
 * px, or a CSS length (the TV shell's are in rem, 10.3). The mark is 54 % of the side; its line is heavier up to 40 px,
 * so it holds in the header (7.17).
 */
export function ProfileAvatar({ avatar, name, size = 40, className }: { avatar: string; name: string; size?: number | string; className?: string }) {
  const { color, mark } = avatarParts(avatar);
  const initial = [...name.trim()][0]?.toUpperCase();
  const scaled = (k: number) => (typeof size === "number" ? size * k : `calc(${size} * ${k})`);
  const line = typeof size === "number" && size <= 40 ? 2.2 : 1.8;
  return (
    <span
      aria-hidden
      className={clsx("inline-grid shrink-0 place-items-center rounded-avatar font-extrabold text-white shadow-inner", className)}
      style={{ width: size, height: size, background: AVATAR_BACKGROUND[color], fontSize: scaled(0.42) }}
    >
      {mark ? (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={line}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-sm/25"
          style={{ width: "54%", height: "54%" }}
        >
          <use href={avatarMarkHref(mark)} />
        </svg>
      ) : (
        initial && <span className="drop-shadow-sm/35">{initial}</span>
      )}
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
