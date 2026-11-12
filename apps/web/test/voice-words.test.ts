import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import de from "../messages/de.json";
import en from "../messages/en.json";
import es from "../messages/es.json";
import fr from "../messages/fr.json";
import it_ from "../messages/it.json";
import pl from "../messages/pl.json";
import ptBR from "../messages/pt-BR.json";
import ru from "../messages/ru.json";
import tr from "../messages/tr.json";
import uk from "../messages/uk.json";
import { trackWords } from "../src/components/player/player-parts";
import { releaseText, studioShown } from "../src/components/sources/release-text";
import { capital } from "../src/components/settings/locale-options";
import { DUBBING, isDubbing, studioWord } from "../src/lib/media/dubbing";
import { bestOf, parseRelease, profileNameTrack, rankReleases, type ReleasePrefs, voiceOptions, withFileTracks } from "../src/lib/media/releases";
import type { TsSearchResult } from "../src/lib/media/torrserver";
import { findOf } from "../src/lib/torrent-finds";

// Kinds of translation as the code keeps them: never words a person reads.
const TOKEN = /(?<![\p{L}\d])(?:dub|mvo|dvo|avo|vo)(?![\p{L}\d])/iu;
const LANGS = { de, en, es, fr, it: it_, pl, "pt-BR": ptBR, ru, tr, uk } as const;

const result = (title: string, seeders = 40): TsSearchResult => ({ title, link: `magnet:?xt=urn:btih:${title.length}${seeders}`, hash: null, size: 4e9, seeders, peers: null, tracker: "RuTracker.org", published: null });
const OPPENHEIMER = { title: "Оппенгеймер", originalTitle: "Oppenheimer", kind: "movie" as const, year: 2023, originalLanguage: "en" };
const RESULTS = [
  result("Оппенгеймер / Oppenheimer (2023) WEB-DL 1080p | 2x Dub + MVO + AVO + Original Eng", 120),
  result("Оппенгеймер / Oppenheimer (2023) BDRip 1080p | MVO (LostFilm) + DVO + VO + Original", 60),
  result("Оппенгеймер / Oppenheimer (2023) WEB-DLRip 720p | AVO (Гаврилов)", 20),
  result("Оппенгеймер / Oppenheimer (2023) WEB-DL 1080p | Ukr Dub + Original", 30),
];
const prefs: ReleasePrefs = { languages: ["ru", "uk"], studios: [DUBBING, "LostFilm"], quality: "auto", device: { hevc: true, hdr: true, uhd: false, dolbyVision: false } };

for (const [locale, messages] of Object.entries(LANGS)) {
  const t = createTranslator({ locale, messages, namespace: "title" }) as unknown as Parameters<typeof releaseText>[0];
  const tp = createTranslator({ locale, messages, namespace: "player" }) as unknown as Parameters<typeof trackWords>[0];
  const text = releaseText(t, locale);
  const dubbed = messages.title.voice_dub;
  const words = trackWords(tp, t, text, "en");

  describe(`translation kinds in words, never "dub" or "MVO" (${locale})`, () => {
    it("the profile's Dubbing is the interface's word for a dub, typed by hand too; another studio as written", () => {
      // Its studios dialog, the "Your voice-over" tag and the settings row ("Russian · Dubbing, LostFilm").
      expect(studioShown(t, DUBBING)).toBe(capital(dubbed, locale));
      expect(studioShown(t, "Дубляж")).toBe(capital(dubbed, locale));
      expect(studioWord(DUBBING, capital(dubbed, locale))).toBe(capital(dubbed, locale));
      expect(studioShown(t, "LostFilm")).toBe("LostFilm");
      // The word the interface shows, typed back as a studio, is the same entry.
      expect(isDubbing(capital(dubbed, locale))).toBe(true);
      expect(isDubbing(dubbed)).toBe(true);
    });

    it("the home shelf names a find made for the profile's Dubbing as a dub", () => {
      const ranked = rankReleases(RESULTS, OPPENHEIMER, prefs);
      const find = findOf(bestOf(ranked), ranked);
      // What the shelf keeps is the profile's own entry; it is never shown as that.
      expect(find?.studio).toBe(DUBBING);
      expect(studioWord(find!.studio!, dubbed)).toBe(dubbed);
    });

    it("the Audio choice's options say a dub and a language, never a kind's code", () => {
      const options = voiceOptions(rankReleases(RESULTS, OPPENHEIMER, prefs));
      expect(options.length).toBeGreaterThan(1);
      for (const o of options) expect(text.option(o)).not.toMatch(TOKEN);
      expect(options.filter((o) => o.voice === "dub" && !o.studio).map((o) => text.option(o))).toContain(capital(dubbed, locale));
    });

    it("what a release plays, and all its tracks, in words", () => {
      const info = parseRelease(RESULTS[0]!.title, null, "en");
      const heard = profileNameTrack(info, prefs);
      expect(heard?.voice).toBe("dub");
      expect(text.audio({ info, language: "ru" }, heard)).toBe(`${capital(new Intl.DisplayNames([locale], { type: "language" }).of("ru")!, locale)} · ${dubbed}`);
      for (const r of RESULTS) {
        const x = { info: parseRelease(r.title, null, "en"), language: null };
        expect(text.audio(x)).not.toMatch(TOKEN);
        // A release's details: every track under its language; French says "VO" for the original.
        for (const line of text.allTracks(x)) expect(line.replace(messages.title.tsOriginal, "")).not.toMatch(TOKEN);
      }
    });

    it("a file's tracks, as a copy's heading and the player's audio menu say them", () => {
      const file = ["rus|Dub, Movie Dubbing", "rus|MVO [LostFilm]", "rus|DVO (Pazl Voice)", "rus|AVO (Гаврилов)", "ukr|Dub", "eng|Original"];
      const info = withFileTracks(parseRelease("Oppenheimer.2023.1080p.WEB-DL", null, "en"), file, "en");
      expect(text.audio({ info, language: "ru" }, profileNameTrack(info, prefs))).toBe(`${capital(new Intl.DisplayNames([locale], { type: "language" }).of("ru")!, locale)} · ${dubbed} (Movie Dubbing)`);
      for (const entry of file.slice(0, 5)) {
        const [tag, title] = entry.split("|");
        expect(words(title!, tag!)).not.toMatch(TOKEN);
      }
      expect(words("Dub, Movie Dubbing", "rus")).toContain(`${dubbed} (Movie Dubbing)`);
      expect(words("MVO [LostFilm]", "rus")).toContain(`${messages.title.voice_mvo} (LostFilm)`);
    });
  });
}
