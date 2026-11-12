import type { MetadataRoute } from "next";
import { INTERFACE_LOCALES } from "@/i18n/locales";
import { languageAlternates, localizedPath, SITE_URL } from "@/lib/seo";

/**
 * The site's own pages in each finished language, with hreflang. Titles and people are not listed: they are
 * found through the server-rendered links of these pages, and a full list would need the API at build time (or a
 * paged sitemap over its title cache) — not a cheap source.
 */
const PAGES: { path: string; changeFrequency: "daily" | "monthly" }[] = [
  { path: "/", changeFrequency: "daily" },
  { path: "/browse/movie", changeFrequency: "daily" },
  { path: "/browse/tv", changeFrequency: "daily" },
  { path: "/anime", changeFrequency: "daily" },
  ...["terms", "privacy", "credits", "copyright"].map((doc) => ({ path: `/legal/${doc}`, changeFrequency: "monthly" as const })),
];

export const dynamic = "force-dynamic"; // SITE_URL is the server's runtime setting

const absolute = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, changeFrequency }) => {
    const languages = Object.fromEntries(Object.entries(languageAlternates(path)).map(([lang, p]) => [lang, absolute(p)]));
    return INTERFACE_LOCALES.map((l) => ({
      url: absolute(localizedPath(l.code, path)),
      changeFrequency,
      alternates: { languages },
    }));
  });
}
