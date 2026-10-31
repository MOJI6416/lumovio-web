import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import ru from "../messages/ru.json";
import uk from "../messages/uk.json";
import { capitalize, formatDate, formatSize, latinLang, relativeTime } from "../src/lib/format";

const NBSP = /[  ]/g;
const plain = (s: string | null) => s?.replace(NBSP, " ") ?? null;

describe("one size formatter, in the person's units (2.3, L10N-09)", () => {
  const GB = 1024 ** 3;
  const MB = 1024 ** 2;
  it("says 9,6 ГБ and 700 МБ in Russian, 9.6 GB in English", () => {
    expect(plain(formatSize(9.6 * GB, "ru"))).toBe("9,6 ГБ");
    expect(plain(formatSize(700 * MB, "ru"))).toBe("700 МБ");
    expect(plain(formatSize(9.6 * GB, "uk"))).toBe("9,6 ГБ");
    expect(plain(formatSize(9.6 * GB, "en"))).toBe("9.6 GB");
  });
  it("keeps a decimal for small amounts (speeds, the loaded start) and goes down to kilobytes", () => {
    expect(plain(formatSize(2.3 * MB, "en"))).toBe("2.3 MB");
    expect(plain(formatSize(512 * 1024, "ru"))).toBe("512 кБ");
    expect(plain(formatSize(2 * 1024 * GB, "en"))).toBe("2 TB");
  });
  it("says nothing for nothing", () => {
    expect(formatSize(null, "ru")).toBeNull();
    expect(formatSize(0, "ru")).toBeNull();
  });
});

describe("relative time (2.3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  const ago = (sec: number) => new Date(Date.now() - sec * 1000).toISOString();
  it("is «только что» under a minute when the words are given", () => {
    expect(relativeTime(ago(20), "ru", ru.common.justNow)).toBe("только что");
    expect(relativeTime(ago(20), "uk", uk.common.justNow)).toBe("щойно");
    expect(relativeTime(ago(20), "en", en.common.justNow)).toBe("just now");
  });
  it("counts minutes, hours and days up to a week, with «вчера»", () => {
    expect(relativeTime(ago(5 * 60), "ru")).toBe("5 минут назад");
    expect(relativeTime(ago(3 * 3600), "ru")).toBe("3 часа назад");
    expect(relativeTime(ago(26 * 3600), "ru")).toBe("вчера");
    expect(relativeTime(ago(3 * 86400), "ru")).toBe("3 дня назад");
  });
  it("gives the date after a week, with the year only when it is another one", () => {
    expect(plain(relativeTime("2026-10-10T12:00:00Z", "ru"))).toBe("10 окт.");
    expect(plain(relativeTime("2025-03-02T12:00:00Z", "ru"))).toBe("2 марта 2025 г.");
    expect(plain(relativeTime("2026-10-10T12:00:00Z", "en"))).toBe("Oct 10");
  });
});

describe("dates that don't break apart (L10N-17)", () => {
  const NB = String.fromCharCode(0xa0);
  it("keeps the year with «р.» / «г.» and the day with its month", () => {
    expect(formatDate("2008-01-20", "uk")).toBe(`20${NB}січ. 2008${NB}р.`);
    expect(formatDate("2008-01-20", "ru", { day: "numeric", month: "long", year: "numeric" })).toBe(`20${NB}января 2008${NB}г.`);
    expect(plain(formatDate("2008-01-20", "en"))).toBe("Jan 20, 2008");
    expect(relativeTime("2025-03-02T12:00:00Z", "uk")).toBe(`2${NB}березня 2025${NB}р.`);
  });
});

describe("catalog names as labels and text a source doesn't translate", () => {
  it("writes a genre with a capital letter in every language (CAT-09)", () => {
    expect(capitalize("драма", "ru")).toBe("Драма");
    expect(capitalize("історія", "uk")).toBe("Історія");
    expect(capitalize("Drama", "en")).toBe("Drama");
  });
  it("marks a Latin-only character name as English on a Cyrillic page (TTL-26)", () => {
    expect(latinLang("Paul Atreides", "ru")).toBe("en");
    expect(latinLang("Paul Atreides", "uk")).toBe("en");
    expect(latinLang("Пол Атрейдес", "ru")).toBeUndefined();
    expect(latinLang("Paul Atreides", "en")).toBeUndefined();
    expect(latinLang("Paul Atreides", "pt-BR")).toBeUndefined();
    expect(latinLang("(voice)", "ru")).toBe("en");
    expect(latinLang("—", "ru")).toBeUndefined();
    expect(latinLang(null, "ru")).toBeUndefined();
  });
});
