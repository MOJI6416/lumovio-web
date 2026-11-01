/** ffprobe's and the servers' ISO 639-2 codes (B and T forms) for languages a track is tagged with. */
const ISO_639_2: Record<string, string> = {
  rus: "ru",
  ukr: "uk",
  eng: "en",
  jpn: "ja",
  ger: "de",
  deu: "de",
  fre: "fr",
  fra: "fr",
  spa: "es",
  ita: "it",
  pol: "pl",
  kor: "ko",
  chi: "zh",
  zho: "zh",
  por: "pt",
  tur: "tr",
  dut: "nl",
  nld: "nl",
  swe: "sv",
  nor: "no",
  dan: "da",
  fin: "fi",
  cze: "cs",
  ces: "cs",
  hun: "hu",
  rum: "ro",
  ron: "ro",
  bul: "bg",
  gre: "el",
  ell: "el",
  heb: "he",
  ara: "ar",
  hin: "hi",
  tha: "th",
  vie: "vi",
  ind: "id",
  bel: "be",
  kaz: "kk",
  geo: "ka",
  kat: "ka",
  lit: "lt",
  lav: "lv",
  est: "et",
};

/** A track's language tag as an ISO 639-1 code ("rus" → "ru", "pt-BR" → "pt"); "und" and nothing are null. */
export function languageCode(tag: string | null | undefined): string | null {
  const t = (tag ?? "").trim().toLowerCase().split(/[-_]/)[0]!;
  if (!t || t === "und" || t === "unk" || t === "mis" || t === "zxx" || t === "mul") return null;
  if (t.length === 2) return t;
  return ISO_639_2[t] ?? t;
}

/** The languages of a file's audio tracks, each once, in their order (ISO 639-1); untagged tracks left out. */
export function audioLanguages(tags: (string | null | undefined)[], max = 8): string[] {
  return [...new Set(tags.map(languageCode).filter((l): l is string => l !== null && /^[a-z]{2,3}$/.test(l)))].slice(0, max);
}
