"use client";

import type { Profile } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { languageName } from "@/lib/format";
import { studioWord } from "@/lib/media/dubbing";
import { capital } from "./locale-options";

/**
 * The words for what a profile hears and reads, as Settings → Profile shows them in its rows. A module of its own, so
 * a screen that only names these values (the setup screen, the home page's shelf) doesn't load the settings page.
 */

/** "Ukrainian, English" — the chosen languages in their order, or "Not chosen". */
export function useLanguageList() {
  const ts = useTranslations("settings");
  const locale = useLocale();
  return (codes: string[]) => (codes.length ? codes.map((c) => capital(languageName(c, locale) ?? c, locale)).join(", ") : ts("notChosen"));
}

/** The audio row's value: the languages in order and, for an adult, the studios ("Ukrainian · LostFilm, Dubbing"). */
export function useAudioValue() {
  const tt = useTranslations("title");
  const locale = useLocale();
  const list = useLanguageList();
  return (value: Pick<Profile, "audioLanguages" | "voiceStudios">, kids: boolean) => {
    const audio = list(value.audioLanguages);
    // The profile's "Dubbing" by its name in the interface, as its studios dialog lists it; the other studios as written.
    const studios = value.voiceStudios.map((s) => studioWord(s, capital(tt("voice_dub"), locale))).join(", ");
    return kids || value.voiceStudios.length === 0 ? audio : `${audio} · ${studios}`;
  };
}
