import { LOCALE_CODES } from "@/i18n/locales";

/** A path without its locale prefix ("/de/browse/movie" → "/browse/movie"; English has none). */
export const withoutLocale = (pathname: string) =>
  pathname.replace(new RegExp(`^/(${LOCALE_CODES.join("|")})(?=/|$)`), "") || "/";
