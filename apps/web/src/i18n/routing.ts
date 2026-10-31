import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALE_CODES } from "./locales";

export const routing = defineRouting({
  locales: LOCALE_CODES,
  defaultLocale: DEFAULT_LOCALE,
  // English lives at "/", other locales are prefixed ("/uk/…") for clean hreflang SEO.
  localePrefix: "as-needed",
  localeCookie: { name: "lumovio_locale", maxAge: 60 * 60 * 24 * 365 },
  // hreflang comes from each public page's metadata (lib/seo.ts), finished languages only; next-intl's own Link
  // header would list all 16, drafts included, for every address — personal pages too (SH-13).
  alternateLinks: false,
});
