import type { AvatarMark } from "@lumovio/contracts";

/*
 * The white marks of profile avatars (design-system 7.17; the owner's choice of 2026-11-01, "mark on a colour"): line
 * drawings on a 24 grid in the logo's manner — cinema, the sky, animals, nature. Lumovio's own drawings, not lucide's
 * action icons (6.4): the avatar's star is a four-pointed sparkle, not "Rate"'s Star, and there is no heart
 * ("Favourites"). The drawings live in one sprite, `public/brand/avatar-marks.svg` (a symbol per mark), drawn by
 * `<use>` in ui/Avatar: as paths in the bundle they cost every page ~1 KB gzip, as a file they load once and stay
 * cached. Change a drawing there and raise `AVATAR_MARKS_VERSION`. Keyed by every contracts `AvatarMark` (the type
 * checks none is missing; test/avatar-marks.test.ts checks the sprite has each), so the editor takes its list from here
 * — importing the `AVATAR_MARKS` value would bring zod into the page.
 */
const MARKS: Record<AvatarMark, 1> = {
  projector: 1,
  clapper: 1,
  popcorn: 1,
  ticket: 1,
  meteor: 1,
  moon: 1,
  planet: 1,
  sparkle: 1,
  rocket: 1,
  sun: 1,
  fox: 1,
  owl: 1,
  whale: 1,
  cat: 1,
  mountain: 1,
  wave: 1,
};

/** Every mark, in the editor's order: cinema, the sky, animals, nature. */
export const AVATAR_MARK_IDS = Object.keys(MARKS) as AvatarMark[];

/** Raised when a drawing in the sprite changes, so browsers fetch it again. */
export const AVATAR_MARKS_VERSION = 1;

/** The sprite's address for one mark. */
export const avatarMarkHref = (mark: AvatarMark) => `/brand/avatar-marks.svg?v=${AVATAR_MARKS_VERSION}#${mark}`;
