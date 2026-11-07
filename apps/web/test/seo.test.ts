import { describe, expect, it } from "vitest";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import { languageAlternates, localizedPath, ogBase, seoAlternates } from "../src/lib/seo";

describe("addresses for search and previews (SH-13)", () => {
  it("prefixes every language but English", () => {
    expect(localizedPath("en", "/")).toBe("/");
    expect(localizedPath("ru", "/")).toBe("/ru");
    expect(localizedPath("uk", "/title/movie/438631")).toBe("/uk/title/movie/438631");
    expect(localizedPath("en", "/title/movie/438631")).toBe("/title/movie/438631");
  });

  it("puts a page's canonical at its own language, a draft's at English", () => {
    expect(seoAlternates("ru", "/title/movie/438631").canonical).toBe("/ru/title/movie/438631");
    expect(seoAlternates("en", "/anime").canonical).toBe("/anime");
    expect(seoAlternates("de", "/anime").canonical).toBe("/de/anime");
    expect(seoAlternates("pl", "/anime").canonical).toBe("/pl/anime");
    expect(seoAlternates("tr", "/anime").canonical).toBe("/tr/anime");
    expect(seoAlternates("fr", "/anime").canonical).toBe("/fr/anime");
    expect(seoAlternates("it", "/anime").canonical).toBe("/it/anime");
    expect(seoAlternates("es", "/anime").canonical).toBe("/es/anime");
    expect(seoAlternates("pt-BR", "/anime").canonical).toBe("/pt-BR/anime");
    // Every language is finished since 2026-10-29; one that isn't an interface language is indexed in English.
    expect(seoAlternates("nl", "/anime").canonical).toBe("/anime");
  });

  it("lists only the finished languages and x-default in hreflang", () => {
    expect(languageAlternates("/browse/tv")).toEqual({
      en: "/browse/tv",
      uk: "/uk/browse/tv",
      ru: "/ru/browse/tv",
      es: "/es/browse/tv",
      de: "/de/browse/tv",
      fr: "/fr/browse/tv",
      "pt-BR": "/pt-BR/browse/tv",
      it: "/it/browse/tv",
      pl: "/pl/browse/tv",
      tr: "/tr/browse/tv",
      "x-default": "/browse/tv",
    });
  });

  it("gives og:locale as language_TERRITORY with the other finished languages", () => {
    const og = ogBase("uk", "/");
    expect(og.locale).toBe("uk_UA");
    expect(og.alternateLocale).toEqual(["en_US", "ru_RU", "es_ES", "de_DE", "fr_FR", "pt_BR", "it_IT", "pl_PL", "tr_TR"]);
    expect(og.url).toBe("/uk");
    expect(ogBase("de", "/").locale).toBe("de_DE");
    expect(ogBase("es", "/").locale).toBe("es_ES");
    expect(ogBase("pt-BR", "/").locale).toBe("pt_BR");
    expect(ogBase("nl", "/").locale).toBe("en_US");
  });
});

describe("robots.txt and sitemap.xml", () => {
  it("closes personal pages in every language but keeps the catalogue open", () => {
    const rules = robots().rules;
    const disallow = (Array.isArray(rules) ? rules[0]! : rules).disallow as string[];
    for (const path of ["/api/", "/library", "/ru/settings", "/uk/watch", "/de/tv", "/dev", "/ru/auth"]) expect(disallow).toContain(path);
    // No private console is named: robots.txt would tell where it lives.
    expect(disallow.some((d) => d.includes("admin"))).toBe(false);
    // Robots rules are prefixes: none may cover a public address.
    for (const open of ["/browse/tv", "/ru/browse/tv", "/title/tv/1399", "/ru/title/movie/1", "/u/library", "/lists/x", "/ru/legal/terms", "/anime", "/search"]) {
      expect(disallow.some((d) => open.startsWith(d))).toBe(false);
    }
  });

  it("lists each public page once per finished language, with alternates", () => {
    const urls = sitemap();
    const home = urls.filter((u) => /^https?:\/\/[^/]+(\/(ru|uk|de|fr|it|pl|tr|es|pt-BR))?$/.test(u.url));
    expect(home).toHaveLength(10);
    expect(urls.every((u) => Object.keys(u.alternates?.languages ?? {}).sort().join() === "de,en,es,fr,it,pl,pt-BR,ru,tr,uk,x-default")).toBe(true);
    expect(urls.some((u) => u.url.includes("/library") || u.url.includes("/ja/"))).toBe(false);
  });
});
