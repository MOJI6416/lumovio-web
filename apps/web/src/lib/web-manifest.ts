import type { MetadataRoute } from "next";

/**
 * The PWA manifest in one language: `lang`, a stable `id` (installing from /ru or /uk is
 * the same app), the name "Lumovio" and the tagline as the description in that language, the start address in the
 * site's language. `theme_color` is the dark --bg; the browser chrome follows the chosen theme by the page's meta tag.
 */
export function webManifest({ lang, locale, description }: { lang: string; locale: string; description: string }): MetadataRoute.Manifest {
  return {
    id: "/",
    lang,
    dir: "ltr",
    name: "Lumovio",
    short_name: "Lumovio",
    description,
    start_url: locale === "en" ? "/" : `/${locale}`,
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0b", // ui-lint-ignore hex-color: the manifest takes literal colours
    theme_color: "#0a0a0b", // ui-lint-ignore hex-color: the manifest takes literal colours
    orientation: "any",
    categories: ["entertainment", "video"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
