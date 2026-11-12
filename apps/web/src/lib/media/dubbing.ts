/**
 * "Dubbing" in the profile's studios: any studio's dub, as one entry of the order
 * ("1 — Dubbing, 2 — LostFilm"). Stored as `DUBBING`; the word typed by hand in a language counts as it too — the
 * interface's own word for it among them. A module of its own, so a screen that only names the profile's studios
 * (settings, the home shelf) doesn't load the release parser.
 */
export const DUBBING = "dub";
export const isDubbing = (studio: string) =>
  /^(?:dub|dubbed|dubbing|дубляж|дубльований|дубльоване|дублированный|doblaje|doublage|dublado|dublagem|doppiaggio|dublaj|synchronfassung|synchronisation)$/iu.test(studio.trim());

/**
 * A studio of the profile in words: its "Dubbing" as `dubbing` — the interface's word for a dub (`title.voice_dub`),
 * capitalised where the studios are named as a list — any other studio as written.
 */
export const studioWord = (studio: string, dubbing: string) => (isDubbing(studio) ? dubbing : studio);
