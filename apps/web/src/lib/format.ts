export function formatRuntime(min: number | null | undefined, t: (k: string, v: Record<string, number>) => string): string | null {
  if (!min) return null;
  if (min < 60) return t("common.minutes", { count: min });
  if (min % 60 === 0) return t("common.hours", { h: min / 60 });
  return t("common.hoursMinutes", { h: Math.floor(min / 60), m: min % 60 });
}

/**
 * A date that doesn't break where it shouldn't: the day stays with its month and the year with «г.» / «р.»
 * («20 січ. 2008 р.» never ends a line with «р.» alone) — non-breaking spaces after a number before a word.
 */
const keepTogether = (s: string) => s.replace(/(\d) (?=\p{L})/gu, "$1\u00a0");

export function formatDate(iso: string | null | undefined, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return keepTogether(new Intl.DateTimeFormat(locale, { timeZone: iso.length === 10 ? "UTC" : undefined, ...opts }).format(d));
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * When something happened: "только что" under a minute (`justNow` — pass `common.justNow`),
 * then minutes, hours, "вчера" and days up to a week; older — the date ("24 окт.", with the year when it is another one).
 */
export function relativeTime(iso: string, locale: string, justNow?: string): string {
  const at = new Date(iso);
  const diff = (at.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return justNow ?? rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  const thisYear = at.getFullYear() === new Date().getFullYear();
  return keepTogether(new Intl.DateTimeFormat(locale, thisYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "long", year: "numeric" }).format(at));
}

/**
 * A size in the person's units and decimal sign ("9,6 ГБ", "700 МБ"; "9.6 GB" in English) — the one formatter for
 * file sizes, loaded amounts and speeds. Binary steps, as TorrServer and the players count; null for nothing.
 */
export function formatSize(bytes: number | null | undefined, locale: string): string | null {
  if (!bytes || bytes <= 0) return null;
  const as = (value: number, unit: "kilobyte" | "megabyte" | "gigabyte" | "terabyte", digits: number) =>
    new Intl.NumberFormat(locale, { style: "unit", unit, maximumFractionDigits: digits }).format(value);
  if (bytes >= 1024 ** 4) return as(bytes / 1024 ** 4, "terabyte", 1);
  if (bytes >= 1024 ** 3) return as(bytes / 1024 ** 3, "gigabyte", 1);
  if (bytes >= 1024 ** 2) return as(bytes / 1024 ** 2, "megabyte", bytes < 10 * 1024 ** 2 ? 1 : 0);
  return as(Math.max(1, bytes / 1024), "kilobyte", 0);
}

/** "драма" → "Драма": a name from the catalog (a genre, a language) as a label, link or chip — one case everywhere. */
export const capitalize = (s: string, locale: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

const LATIN_LOCALES = /^(en|es|de|fr|pt|it|pl|tr)\b/;

/**
 * The `lang` of a text a source doesn't translate (TMDB's character names): "en" on a page in a language with its own
 * script (ru, uk) when the text is Latin letters only, so a screen reader reads it in English.
 */
export function latinLang(text: string | null | undefined, locale: string): "en" | undefined {
  if (!text || LATIN_LOCALES.test(locale) || !/\p{L}/u.test(text)) return undefined;
  return /[^\p{Script=Latin}\P{L}]/u.test(text) ? undefined : "en";
}

export function languageName(code: string | null | undefined, locale: string): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function regionName(code: string | null | undefined, locale: string): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** YYYY-MM-DD of a moment in the viewer's own time zone (toISOString would give the UTC day). */
export function localDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The viewer's day for a calendar entry: an exact start is moved into their time zone (a US evening
 * episode is the next morning in Kyiv); a date-only release keeps its published date.
 */
export function eventDay(e: { date: string; airstamp: string | null }): string {
  return e.airstamp ? localDay(new Date(e.airstamp)) : e.date;
}

/** Whether a calendar entry is out: its start has passed, or (date only) its day has begun. */
export function hasAired(e: { date: string; airstamp: string | null }, now = new Date()): boolean {
  return e.airstamp ? Date.parse(e.airstamp) <= now.getTime() : e.date <= localDay(now);
}

