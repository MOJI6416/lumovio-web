import type { MetadataRoute } from "next";
import { LOCALE_CODES } from "@/i18n/locales";
import { SITE_URL } from "@/lib/seo";

/**
 * Pages search engines should not crawl (SH-13). Personal or session pages say nothing to a crawler and some do work
 * when opened (the TV page asks for a pairing code); the catalogue, titles, people, public lists and profiles, search
 * and the legal pages stay open.
 */
const PRIVATE = [
  "auth", // sign-in, sign-up, password reset, two-factor
  "calendar", // a profile's release calendar
  "dev", // the component showcase
  "import", // history import
  "invite", // list and account invitations (one-time tokens)
  "library", // a profile's library
  "link", // approving a TV with a code
  "open", // retired collection, redirects to the catalogue
  "profiles", // "Who's watching?"
  "settings", // account and profile settings
  "stats", // a profile's year in review
  "tv", // the TV entry point, which requests a pairing code
  "watch", // the player
];

// English is unprefixed, every other language (finished or draft) is "/ru/…". No wildcards: "/*/tv" would also
// match "/browse/tv", and "/*/library" a public profile "/u/library".
const PREFIXES = ["", ...LOCALE_CODES.map((c) => `/${c}`)];

/**
 * Crawlers that gather pages to train AI models stay out of the whole site (the owner, 2026-11-12): they were ~150k of
 * ~210k API requests an hour and used up TMDB's limit (docs/operations.md, incident checklist 6). The agents that fetch
 * a page to answer a person's question — OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot —
 * aren't named, so they follow "*" like search engines, and Lumovio still shows up in AI answers. Google-Extended and
 * Applebot-Extended are tokens, not crawlers: they keep pages out of Gemini's and Apple's training, not out of search.
 */
export const AI_TRAINING = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
];

export const dynamic = "force-dynamic"; // SITE_URL is the server's runtime setting

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", ...PRIVATE.flatMap((segment) => PREFIXES.map((p) => `${p}/${segment}`))],
      },
      { userAgent: AI_TRAINING, disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
