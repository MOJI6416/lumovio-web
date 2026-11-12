import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTENT_LOCALES,
  INTERFACE_LOCALES,
  interfaceAcceptLanguage,
  interfaceLocaleOptions,
  isInterfaceLocale,
  LOCALES,
  pickInterfaceLocale,
  REMOVED_LOCALES,
  removedLocaleRedirect,
} from "../src/i18n/locales";
import { withEnglish } from "../src/i18n/messages";

const MESSAGES = join(__dirname, "..", "messages");

describe("languages offered for the interface", () => {
  it("offers only finished translations", () => {
    expect(INTERFACE_LOCALES.map((l) => l.code).sort()).toEqual(["de", "en", "es", "fr", "it", "pl", "pt-BR", "ru", "tr", "uk"]);
    expect(isInterfaceLocale("ru")).toBe(true);
    expect(isInterfaceLocale("de")).toBe(true);
    expect(isInterfaceLocale("pl")).toBe(true);
    expect(isInterfaceLocale("tr")).toBe(true);
    expect(isInterfaceLocale("fr")).toBe(true);
    expect(isInterfaceLocale("it")).toBe(true);
    expect(isInterfaceLocale("es")).toBe(true);
    expect(isInterfaceLocale("pt-BR")).toBe(true);
    expect(isInterfaceLocale("pt")).toBe(false);
    expect(isInterfaceLocale(null)).toBe(false);
  });

  it("keeps the current draft language in the picker so the person can see it and leave it", () => {
    expect(interfaceLocaleOptions("ru").map((l) => l.code).sort()).toEqual(INTERFACE_LOCALES.map((l) => l.code).sort());
    // Every language is finished now; a draft added later stays in the picker while it is the current one.
    for (const draft of LOCALES.filter((l) => l.status === "draft")) {
      expect(interfaceLocaleOptions(draft.code).map((l) => l.code)).toContain(draft.code);
    }
    expect(interfaceLocaleOptions(undefined)).toHaveLength(INTERFACE_LOCALES.length);
    expect(interfaceLocaleOptions("xx")).toHaveLength(INTERFACE_LOCALES.length);
    expect(interfaceLocaleOptions("ja")).toHaveLength(INTERFACE_LOCALES.length);
  });

  it("offers every language for descriptions", () => {
    expect(CONTENT_LOCALES).toHaveLength(LOCALES.length);
  });

  it("lists languages by their own names, Latin before Cyrillic", () => {
    expect(CONTENT_LOCALES.map((l) => l.code)).toEqual(["de", "en", "es", "fr", "it", "pl", "pt-BR", "tr", "ru", "uk"]);
    const names = interfaceLocaleOptions("es").map((l) => l.name);
    expect(names).toEqual([...names].sort(new Intl.Collator("en").compare));
  });

  it("is the ten languages of the product, written left to right", () => {
    expect(LOCALES.map((l) => l.code)).toEqual([
      "en",
      "uk",
      "ru",
      "es",
      "de",
      "fr",
      "pt-BR",
      "it",
      "pl",
      "tr",
    ]);
    expect(LOCALES.every((l) => l.dir === "ltr")).toBe(true);
  });
});

describe("browser language never selects a draft", () => {
  it("narrows Accept-Language to interface languages", () => {
    expect(interfaceAcceptLanguage("nl-NL,nl;q=0.9")).toBe("");
    expect(interfaceAcceptLanguage("ar-EG,ar;q=0.9,en;q=0.5")).toBe("en;q=0.5");
    expect(interfaceAcceptLanguage("nl-NL,nl;q=0.9,ru;q=0.8,en;q=0.5")).toBe("ru;q=0.8,en;q=0.5");
    expect(interfaceAcceptLanguage("es-ES,es;q=0.9")).toBe("es-ES,es;q=0.9");
    expect(interfaceAcceptLanguage("pt-BR,pt;q=0.9")).toBe("pt-BR");
    expect(interfaceAcceptLanguage("de-DE,de;q=0.9")).toBe("de-DE,de;q=0.9");
    expect(interfaceAcceptLanguage("uk-UA,uk;q=0.9")).toBe("uk-UA,uk;q=0.9");
    expect(interfaceAcceptLanguage("en-US,*;q=0.1")).toBe("en-US");
  });

  it("picks the preferred interface language, or English", () => {
    expect(pickInterfaceLocale("es-ES,es;q=0.9")).toBe("es");
    expect(pickInterfaceLocale("pt-BR,pt;q=0.9")).toBe("pt-BR");
    expect(pickInterfaceLocale("pt-PT,pt;q=0.9")).toBe("en");
    expect(pickInterfaceLocale("de-AT,de;q=0.9")).toBe("de");
    expect(pickInterfaceLocale("pl-PL,pl;q=0.9")).toBe("pl");
    expect(pickInterfaceLocale("tr-TR,tr;q=0.9")).toBe("tr");
    expect(pickInterfaceLocale("nl-NL,ru;q=0.8,uk;q=0.9")).toBe("uk");
    expect(pickInterfaceLocale("ja-JP,ja;q=0.9")).toBe("en");
    expect(pickInterfaceLocale("ru-RU")).toBe("ru");
    expect(pickInterfaceLocale("uk;q=0,ru;q=0.5")).toBe("ru");
    expect(pickInterfaceLocale(null)).toBe("en");
  });
});

describe("languages taken out of Lumovio", () => {
  it("are gone from the registry", () => {
    for (const code of REMOVED_LOCALES) expect(LOCALES.some((l) => l.code === code)).toBe(false);
  });

  it("move their addresses to the English address of the same path for good", () => {
    expect(removedLocaleRedirect("/ja", undefined)).toEqual({ path: "/", pinEnglish: true });
    expect(removedLocaleRedirect("/zh-CN/title/movie/550-fight-club", "zh-CN")).toEqual({
      path: "/title/movie/550-fight-club",
      pinEnglish: true,
    });
    expect(removedLocaleRedirect("/zh-cn/anime", undefined)?.path).toBe("/anime");
    expect(removedLocaleRedirect("/ar/@someone", undefined)?.path).toBe("/@someone");
    // A saved site language stays the visitor's choice.
    expect(removedLocaleRedirect("/hi/search", "ru")).toEqual({ path: "/search", pinEnglish: false });
    // Only a whole first segment: "/id…" pages and the languages that stay are not touched.
    for (const p of ["/de/anime", "/identity", "/korean", "/", "/ru", "/japan/x"])
      expect(removedLocaleRedirect(p, undefined)).toBeNull();
  });
});

describe("messages per language", () => {
  it("every finished language has its messages file, and no file is left for a language the site doesn't have", () => {
    for (const l of INTERFACE_LOCALES) expect(existsSync(join(MESSAGES, `${l.code}.json`))).toBe(true);
    const codes = new Set(LOCALES.map((l) => l.code as string));
    for (const f of readdirSync(MESSAGES).filter((f) => f.endsWith(".json")))
      expect(codes.has(f.replace(/\.json$/, ""))).toBe(true);
  });

  it("a key a translation lacks shows in English, nested ones too", () => {
    const en = { common: { save: "Save", cancel: "Cancel" }, nav: { home: "Home" } };
    const merged = withEnglish(en, { common: { save: "Speichern" } } as Partial<typeof en>);
    expect(merged).toEqual({ common: { save: "Speichern", cancel: "Cancel" }, nav: { home: "Home" } });
    expect(en.common.save).toBe("Save");
  });

  it("the German file has every namespace of the English one but the developer showcase", () => {
    const en = JSON.parse(readFileSync(join(MESSAGES, "en.json"), "utf8"));
    const de = JSON.parse(readFileSync(join(MESSAGES, "de.json"), "utf8"));
    expect(Object.keys(de).sort()).toEqual(
      Object.keys(en)
        .filter((k) => k !== "devUi")
        .sort(),
    );
    expect(de.common.languageDraft).toContain("{name}");
  });
});
