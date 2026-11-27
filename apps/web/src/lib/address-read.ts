/*
 * Reading the site's addresses on the server: the code in a page's address, and TMDB's id in an older one.
 */

/**
 * Lumovio's own code of a title or a person: 8 symbols of Crockford's base32 (digits and lowercase letters without
 * i, l, o, u), always starting with a letter — so a code is never read as a number, and an older address's number
 * never as a code.
 */
const CODE = /^[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{7}$/;
export const isCode = (s: string): boolean => CODE.test(s);

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** The code at the start of an address's part (`ewzsjd5z-matrica` → `ewzsjd5z`); null when it isn't one. */
export function parseCodeSlug(slug: string): string | null {
  const m = /^([0-9a-z]{8})(?:-|$)/.exec(decode(slug));
  return m && isCode(m[1]!) ? m[1]! : null;
}

/** TMDB's id at the start of an older address's part (`603-the-matrix`). A code starts with a letter: never read here. */
export function parseSlugId(slug: string): number | null {
  const m = /^(\d+)(?:-|$)/.exec(decode(slug));
  return m ? Number(m[1]) : null;
}
