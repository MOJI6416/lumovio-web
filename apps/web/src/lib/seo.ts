import { DEFAULT_LOCALE, INTERFACE_LOCALES, isInterfaceLocale } from "@/i18n/locales";
import { OG_IMAGE } from "@/lib/brand";

/**
 * Addresses for search engines and link previews (SH-13): every finished language has its own canonical address,
 * hreflang lists only the finished ones (status "reviewed" in i18n/locales.ts) plus x-default, og:locale is
 * language_TERRITORY. A draft language (/es/…) is mostly English, so its canonical is the English address and it is
 * not listed. Paths are given without
 * the locale prefix ("/title/movie/438631"). A title's or person's address carries its name in that language
 * ("/ru/title/movie/438631-дюна"): its canonical is that address, and hreflang gives each language its own one.
 */

/** The site's public origin (metadataBase, robots.txt, the sitemap). */
export const SITE_URL = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://lumovio.app").replace(/\/+$/, "");

/** Open Graph wants language_TERRITORY. */
const OG_LOCALE: Record<string, string> = {
  en: "en_US",
  ru: "ru_RU",
  uk: "uk_UA",
  de: "de_DE",
  es: "es_ES",
  fr: "fr_FR",
  "pt-BR": "pt_BR",
  it: "it_IT",
  pl: "pl_PL",
  tr: "tr_TR",
};

/** A path in a language: English has no prefix (localePrefix "as-needed", i18n/routing.ts), the others "/ru/…". */
export function localizedPath(locale: string, path: string): string {
  const rest = path === "/" ? "" : path;
  if (locale === DEFAULT_LOCALE) return rest || "/";
  return `/${locale}${rest}`;
}

/** The language a page is indexed in: its own when finished, else English. */
const indexedLocale = (locale: string) => (isInterfaceLocale(locale) ? locale : DEFAULT_LOCALE);

/**
 * hreflang for a path: each finished language, and x-default — the unprefixed address, which sends a first-time
 * visitor to the language of their browser (proxy.ts) and is English otherwise.
 */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of INTERFACE_LOCALES) languages[l.code] = localizedPath(l.code, path);
  languages["x-default"] = localizedPath(DEFAULT_LOCALE, path);
  return languages;
}

/** `alternates` of a public page: canonical at its own language's address, hreflang of the finished languages. */
export function seoAlternates(locale: string, path: string) {
  return { canonical: localizedPath(indexedLocale(locale), path), languages: languageAlternates(path) };
}

/** The language a page's canonical address is in (a draft language is indexed in English). */
export const canonicalLocale = indexedLocale;

/** `alternates` of a page whose path differs per language (its name in the slug): `pathIn(locale)`. */
export function seoAlternatesIn(locale: string, pathIn: (locale: string) => string) {
  const languages: Record<string, string> = {};
  for (const l of INTERFACE_LOCALES) languages[l.code] = localizedPath(l.code, pathIn(l.code));
  languages["x-default"] = localizedPath(DEFAULT_LOCALE, pathIn(DEFAULT_LOCALE));
  const own = indexedLocale(locale);
  return { canonical: localizedPath(own, pathIn(own)), languages };
}

/** og:locale and og:locale:alternate. */
export function ogLocale(locale: string) {
  const own = indexedLocale(locale);
  return {
    locale: OG_LOCALE[own] ?? OG_LOCALE[DEFAULT_LOCALE]!,
    alternateLocale: INTERFACE_LOCALES.filter((l) => l.code !== own).map((l) => OG_LOCALE[l.code] ?? l.code),
  };
}

/**
 * Open Graph of a public page: site, language, its canonical address and the brand image. A page with its own art
 * replaces `images` and `type` (a page's openGraph replaces the layout's whole, so these are repeated here).
 */
export function ogBase(locale: string, path: string) {
  return {
    siteName: "Lumovio",
    type: "website" as const,
    url: localizedPath(indexedLocale(locale), path),
    images: [OG_IMAGE],
    ...ogLocale(locale),
  };
}

/** `alternates` + `openGraph` together, for pages without art of their own. */
export function pageSeo(locale: string, path: string) {
  return { alternates: seoAlternates(locale, path), openGraph: ogBase(locale, path) };
}
