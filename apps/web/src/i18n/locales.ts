interface LocaleDef {
  code: string;
  name: string;
  /** "rtl" stays possible (design-system 8.11) though no language here needs it now. */
  dir: "ltr" | "rtl";
  status: "reviewed" | "draft";
}

/**
 * Locale registry. `status` is shown to users honestly: only "reviewed" locales are presented as
 * finished translations; "draft" locales are labelled and fall back to English per missing key.
 * A language becomes "reviewed" when `node scripts/i18n/check.mjs <code>` finds no errors and its key
 * screens were looked at (design-system 8.11); its messages live in apps/web/messages/<code>.json.
 */
const DEFS = [
  { code: "en", name: "English", dir: "ltr", status: "reviewed" },
  { code: "uk", name: "Українська", dir: "ltr", status: "reviewed" },
  { code: "ru", name: "Русский", dir: "ltr", status: "reviewed" },
  { code: "es", name: "Español", dir: "ltr", status: "reviewed" },
  { code: "de", name: "Deutsch", dir: "ltr", status: "reviewed" },
  { code: "fr", name: "Français", dir: "ltr", status: "reviewed" },
  { code: "pt-BR", name: "Português (Brasil)", dir: "ltr", status: "reviewed" },
  { code: "it", name: "Italiano", dir: "ltr", status: "reviewed" },
  { code: "pl", name: "Polski", dir: "ltr", status: "reviewed" },
  { code: "tr", name: "Türkçe", dir: "ltr", status: "reviewed" },
] as const satisfies readonly LocaleDef[];

export type Locale = (typeof DEFS)[number]["code"];
export type LocaleEntry = LocaleDef & { code: Locale };
export const LOCALES: readonly LocaleEntry[] = DEFS;
export const LOCALE_CODES = DEFS.map((l) => l.code) as unknown as [Locale, ...Locale[]];
export const DEFAULT_LOCALE: Locale = "en";
export const localeInfo = (code: string): LocaleEntry => LOCALES.find((l) => l.code === code) ?? DEFS[0];

/**
 * Languages taken out of Lumovio (owner, 2026-10-29): Japanese, Korean, Chinese, Arabic, Hindi, Indonesian. Their
 * addresses (/ja/…) move to the English address for good (proxy.ts); a saved choice of one reads as English.
 */
export const REMOVED_LOCALES = ["ja", "ko", "zh-CN", "ar", "hi", "id"] as const;

const REMOVED_PREFIX = new RegExp(`^/(${REMOVED_LOCALES.join("|")})(?=/|$)`, "i");

/**
 * Where a removed language's page moves for good (308): the English address of the same path ("/ja/anime" →
 * "/anime"). A visitor without a valid saved language gets English kept in the cookie, as for /en/…, so the
 * unprefixed address doesn't send them on by the browser's language; a saved choice (ru, uk…) is left as it is.
 */
export function removedLocaleRedirect(pathname: string, savedLocale: string | null | undefined): { path: string; pinEnglish: boolean } | null {
  const m = REMOVED_PREFIX.exec(pathname);
  if (!m) return null;
  return { path: pathname.slice(m[0].length) || "/", pinEnglish: !(LOCALE_CODES as readonly string[]).includes(savedLocale ?? "") };
}

/*
 * One source of truth for which languages are offered where (design-system 1.3 and 8.11, L10N-02).
 * Draft languages keep working at their address (/es/…) and as a saved choice, but the interface
 * language picker doesn't offer them and a browser's language never selects them on its own.
 */

/** Languages the interface is offered in: finished translations only. */
export const INTERFACE_LOCALES: readonly LocaleEntry[] = LOCALES.filter((l) => l.status === "reviewed");

export const isInterfaceLocale = (code: string | null | undefined): boolean => INTERFACE_LOCALES.some((l) => l.code === code);

// Pickers list languages as Apple and Google do: alphabetically by the language's own name, Latin scripts before
// Cyrillic (the root collation's order) — Deutsch, English, Español… Русский, Українська (owner, 2026-10-29).
const NAME_ORDER = new Intl.Collator("en");
const byName = (a: LocaleEntry, b: LocaleEntry) => NAME_ORDER.compare(a.name, b.name);

/**
 * Items for an interface-language picker (account menu, profile settings): the finished languages, plus
 * the current one when it is a draft, so the picker shows where the person is and lets them leave it.
 * Label a draft with `common.languageDraft` ("Español (черновик)").
 */
export function interfaceLocaleOptions(current?: string | null): LocaleEntry[] {
  const now = current ? LOCALES.find((l) => l.code === current) : undefined;
  return (now && !isInterfaceLocale(now.code) ? [...INTERFACE_LOCALES, now] : [...INTERFACE_LOCALES]).sort(byName);
}

/** Items for the description (content) language picker: every language, drafts labelled with `common.languageDraft`. */
export const CONTENT_LOCALES: readonly LocaleEntry[] = [...LOCALES].sort(byName);

const matchesInterface = (tag: string) => {
  const t = tag.toLowerCase();
  return INTERFACE_LOCALES.find((l) => t === l.code.toLowerCase() || t.startsWith(`${l.code.toLowerCase()}-`));
};

/**
 * An Accept-Language header narrowed to the interface languages: "es-ES,es;q=0.9,ru;q=0.8" → "ru;q=0.8",
 * "ja-JP,ja;q=0.9" → "" (the default, English). The locale detection then never lands on a draft.
 */
export function interfaceAcceptLanguage(header: string): string {
  return header
    .split(",")
    .map((part) => part.trim())
    .filter((part) => matchesInterface(part.split(";")[0]!.trim()))
    .join(",");
}

/** The interface language a browser prefers most (by q), or the default: for answers outside the locale middleware. */
export function pickInterfaceLocale(header: string | null | undefined): Locale {
  const ranked = (header ?? "")
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.trim().slice(2) ?? 1);
      return { entry: matchesInterface(tag!.trim()), q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((x) => x.entry && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  return ranked[0]?.entry?.code ?? DEFAULT_LOCALE;
}
