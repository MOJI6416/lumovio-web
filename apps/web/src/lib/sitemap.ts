import { INTERFACE_LOCALES } from "@/i18n/locales";
import { languageAlternates, localizedPath, SITE_URL } from "@/lib/seo";
import { personHref, titleHref } from "@/lib/slug";

/*
 * The sitemap: an index (`/sitemap.xml`) of the site's own pages (with hreflang) and of the titles' and people's
 * pages, listed by the API a few thousand at a time (`/sitemaps/titles-1.xml`, `/sitemaps/people-1.xml`). A title is
 * listed in each finished language at the address with its name there; the pages give their own hreflang.
 */

const PAGES: { path: string; changeFrequency: "daily" | "monthly" }[] = [
  { path: "/", changeFrequency: "daily" },
  { path: "/browse/movie", changeFrequency: "daily" },
  { path: "/browse/tv", changeFrequency: "daily" },
  { path: "/anime", changeFrequency: "daily" },
  { path: "/about", changeFrequency: "monthly" },
  ...["terms", "privacy", "credits", "copyright"].map((doc) => ({ path: `/legal/${doc}`, changeFrequency: "monthly" as const })),
];

/** An address of the site, absolute and percent-encoded (a title's name may be Cyrillic). */
const absolute = (path: string) => `${SITE_URL}${encodeURI(path === "/" ? "" : path)}`;
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface SitemapEntry {
  url: string;
  lastModified?: string;
  changeFrequency?: "daily" | "monthly";
  alternates?: Record<string, string>;
}

/** The site's own pages in each finished language, with hreflang. */
export function pageEntries(): SitemapEntry[] {
  return PAGES.flatMap(({ path, changeFrequency }) => {
    const alternates = Object.fromEntries(Object.entries(languageAlternates(path)).map(([lang, p]) => [lang, absolute(p)]));
    return INTERFACE_LOCALES.map((l) => ({ url: absolute(localizedPath(l.code, path)), changeFrequency, alternates }));
  });
}

/** Titles as the API lists them: each in every finished language, at the address with its name there. */
export function titleEntries(titles: { code: string; names: Record<string, string>; updated: string }[]): SitemapEntry[] {
  return titles.flatMap((t) =>
    INTERFACE_LOCALES.map((l) => ({
      // The code is the address's key; TMDB's kind and id aren't needed beside it.
      url: absolute(localizedPath(l.code, titleHref({ code: t.code, kind: "movie", tmdbId: 0 }, t.names[l.code] ?? t.names.en))),
      lastModified: t.updated,
    })),
  );
}

/** People as the API lists them: each in every finished language (one address per person and language). */
export function personEntries(people: { code: string; updated: string }[]): SitemapEntry[] {
  return people.flatMap((p) => INTERFACE_LOCALES.map((l) => ({ url: absolute(localizedPath(l.code, personHref({ code: p.code, id: 0 }))), lastModified: p.updated })));
}

/** A `<urlset>` of entries. */
export function urlset(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const alt = Object.entries(e.alternates ?? {})
        .map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${xml(href)}"/>`)
        .join("");
      const mod = e.lastModified ? `<lastmod>${e.lastModified}</lastmod>` : "";
      const freq = e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : "";
      return `<url><loc>${xml(e.url)}</loc>${alt}${mod}${freq}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

/** The index of the sitemap's files (`pages.xml`, `titles-1.xml`…). */
export function sitemapIndex(files: string[]): string {
  const body = files.map((f) => `<sitemap><loc>${xml(`${SITE_URL}/sitemaps/${f}`)}</loc></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/** The files of the index: the pages', then the titles' and the people's by count. */
export const sitemapFiles = (counts: { titles: number; people: number } | null) => [
  "pages.xml",
  ...Array.from({ length: counts?.titles ?? 0 }, (_, i) => `titles-${i + 1}.xml`),
  ...Array.from({ length: counts?.people ?? 0 }, (_, i) => `people-${i + 1}.xml`),
];

const INTERNAL = process.env.API_INTERNAL_URL ?? process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";

/** A list of the API's sitemap (`/api/v2/sitemap…`); null when it didn't answer. */
export async function sitemapApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${INTERNAL}/api/v2/sitemap${path}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** An XML answer: kept by caches for six hours, five minutes when it is short of what the API didn't answer. */
export const xmlResponse = (body: string, complete: boolean) =>
  new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": `public, max-age=${complete ? 21_600 : 300}` } });
