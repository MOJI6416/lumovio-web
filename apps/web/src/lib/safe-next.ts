import { LOCALE_CODES } from "@/i18n/locales";

/** A leading locale segment; the destination is localized again on navigation. */
const LOCALE_PREFIX = new RegExp(`^/(?:${LOCALE_CODES.join("|")})(?=[/?#]|$)`);

/** Only same-site relative paths are accepted as post-login destinations (no open redirects). */
export function safeNext(raw: string | null, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  const path = raw.replace(LOCALE_PREFIX, "");
  return path.startsWith("/") ? path : `/${path}`;
}
