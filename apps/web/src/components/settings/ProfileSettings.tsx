"use client";

import type { Profile, SubtitleStyle } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Checkbox";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Switch } from "@/components/ui/Switch";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { languageName } from "@/lib/format";
import { VOICE_STUDIOS } from "@/lib/media/releases";
import { SUBTITLE_DEFAULTS } from "@/lib/media/subs/view";
import { useSettingsSave } from "@/lib/use-action";
import { AUTO, capital, useLocaleOptions } from "./locale-options";
import { OrderedChoice } from "./OrderedChoice";

const MEDIA_LANGS = ["en", "uk", "ru", "es", "de", "fr", "pt", "it", "pl", "tr", "ja", "ko", "zh", "ar", "hi", "id"];

type Prefs = Pick<
  Profile,
  "uiLocale" | "metadataLocale" | "region" | "audioLanguages" | "subtitleLanguages" | "subtitleStyle" | "voiceStudios" | "releaseQuality" | "spoilers" | "showAnime"
>;
const pick = (p: Profile): Prefs => ({
  uiLocale: p.uiLocale,
  metadataLocale: p.metadataLocale,
  region: p.region,
  audioLanguages: p.audioLanguages,
  subtitleLanguages: p.subtitleLanguages,
  subtitleStyle: { ...SUBTITLE_DEFAULTS, ...p.subtitleStyle },
  voiceStudios: p.voiceStudios,
  releaseQuality: p.releaseQuality,
  spoilers: p.spoilers,
  showAnime: p.showAnime,
});

/**
 * Settings → Profile (design-system 7.18, 8.8; audit SET-01, SET-02, PRF-13): the active profile's own choices in
 * sections — Language and region · Catalog · Audio and subtitles · Subtitle appearance · Spoilers · Studios · Release
 * quality. Every choice
 * applies at once with "Saved" by its section's title; a refusal puts it back and stays in the section with "Retry". A
 * kids profile keeps its languages, audio and spoilers, not the region or anime (an adult sets them in Manage profiles),
 * studios or quality.
 */
export function ProfileSettings() {
  const { me } = useSession();
  const p = me?.activeProfile;
  const router = useRouter();
  const [value, setValue] = useState<Prefs | null>(p ? pick(p) : null);
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  });
  // A new profile is a new start; the session's copy refreshing after a save doesn't overwrite what's on screen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the profile changes
  useEffect(() => {
    if (p) setValue(pick(p));
  }, [p?.id]);
  if (!p || !value) return null;

  /** The request and the optimistic change for `save` of a section's useSettingsSave (8.8). */
  const change = (patch: Partial<Prefs>) => ({
    request: async () => {
      await api(`/api/profiles/${p.id}`, { method: "PATCH", json: patch });
      // The rest of the site reads the profile from the session: bring it up to date.
      router.refresh();
    },
    optimistic: () => {
      const cur = latest.current!;
      const before = Object.fromEntries(Object.keys(patch).map((k) => [k, cur[k as keyof Prefs]])) as Partial<Prefs>;
      setValue((v) => v && { ...v, ...patch });
      return () => setValue((v) => v && { ...v, ...before });
    },
  });
  const section = { value, change, kids: p.isKids };

  return (
    <div className="space-y-6">
      <LanguageSection {...section} />
      {!p.isKids && <CatalogSection {...section} />}
      <AudioSection {...section} />
      <SubtitleStyleSection {...section} />
      <SpoilersSection {...section} />
      {!p.isKids && <StudiosSection {...section} />}
      {!p.isKids && <QualitySection {...section} />}
      {!p.isKids && <ProfilesSection />}
    </div>
  );
}

type SectionProps = {
  value: Prefs;
  change: (patch: Partial<Prefs>) => { request: () => Promise<void>; optimistic: () => () => void };
  kids: boolean;
};

function LanguageSection({ value, change, kids }: SectionProps) {
  const t = useTranslations("profiles");
  const ts = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const options = useLocaleOptions();
  const { state, save } = useSettingsSave();
  const ids = useId();
  const apply = async (patch: Partial<Prefs>) => {
    const c = change(patch);
    return save(c.request, c.optimistic);
  };
  return (
    <SettingsSection title={kids ? ts("sectionLanguageKids") : ts("sectionLanguage")} save={state}>
      <SettingsRow label={t("uiLanguageProfile")} description={t("uiLanguageProfileHint")} htmlFor={`${ids}-ui`}>
        <Select
          id={`${ids}-ui`}
          className="w-full sm:w-64"
          value={value.uiLocale ?? AUTO}
          onValueChange={async (v) => {
            const next = v === AUTO ? null : v;
            // The site follows the profile's language as soon as it is saved (L10N-06).
            if ((await apply({ uiLocale: next })) && next && next !== locale) router.replace(pathname, { locale: next as never });
          }}
          options={options.ui(value.uiLocale)}
        />
      </SettingsRow>
      <SettingsRow label={t("metadataLanguage")} description={t("metadataLanguageHint")} htmlFor={`${ids}-meta`}>
        <Combobox
          id={`${ids}-meta`}
          className="w-full sm:w-64"
          value={value.metadataLocale ?? AUTO}
          onValueChange={(v) => void apply({ metadataLocale: v === AUTO ? null : v })}
          options={options.metadata}
        />
      </SettingsRow>
      {/* The region decides which country's age ratings apply: a kids profile doesn't change it (PRF-13). */}
      {!kids && (
        <SettingsRow label={t("region")} description={t("regionHint")} htmlFor={`${ids}-region`}>
          <Combobox
            id={`${ids}-region`}
            className="w-full sm:w-64"
            value={value.region ?? AUTO}
            onValueChange={(v) => void apply({ region: v === AUTO ? null : v })}
            options={options.region}
          />
        </SettingsRow>
      )}
    </SettingsSection>
  );
}

function AudioSection({ value, change }: SectionProps) {
  const t = useTranslations("profiles");
  const ts = useTranslations("settings");
  const locale = useLocale();
  const { state, save } = useSettingsSave();
  const langs = MEDIA_LANGS.map((l) => ({
    value: l,
    label: capital(languageName(l, locale) ?? l, locale),
    keywords: [l, languageName(l, l) ?? ""],
  }));
  const apply = (patch: Partial<Prefs>) => {
    const c = change(patch);
    void save(c.request, c.optimistic);
  };
  return (
    <SettingsSection title={ts("sectionAudio")} save={state}>
      <SettingsRow label={t("audioLanguages")} description={t("audioLanguagesOrder")}>
        <OrderedChoice
          value={value.audioLanguages}
          options={langs}
          max={8}
          addLabel={t("addLanguage")}
          listLabel={t("audioLanguages")}
          onChange={(audioLanguages) => apply({ audioLanguages })}
        />
      </SettingsRow>
      <SettingsRow label={t("subtitleLanguages")} description={t("subtitleLanguagesOrder")}>
        <OrderedChoice
          value={value.subtitleLanguages}
          options={langs}
          max={8}
          addLabel={t("addLanguage")}
          listLabel={t("subtitleLanguages")}
          onChange={(subtitleLanguages) => apply({ subtitleLanguages })}
        />
      </SettingsRow>
    </SettingsSection>
  );
}

/**
 * How subtitles look in the player (design-system 11.1): size, text colour, background, position — each applies at
 * once (8.8), and the preview under them shows it on a frame of the picture's proportions. A kids profile has it too.
 */
function SubtitleStyleSection({ value, change }: SectionProps) {
  const t = useTranslations("subtitles");
  const { state, save } = useSettingsSave();
  const style = value.subtitleStyle;
  const apply = (patch: Partial<SubtitleStyle>) => {
    const c = change({ subtitleStyle: { ...style, ...patch } });
    void save(c.request, c.optimistic);
  };
  const choice = <K extends keyof SubtitleStyle>(key: K, options: readonly SubtitleStyle[K][]) => {
    const name: string = key;
    return (
      <SettingsRow label={t(name)}>
        <SegmentedControl<SubtitleStyle[K]>
          label={t(name)}
          value={style[key]}
          onValueChange={(v) => apply({ [key]: v } as Partial<SubtitleStyle>)}
          options={options.map((v) => ({ value: v, label: t(`${name}_${String(v)}`) }))}
        />
      </SettingsRow>
    );
  };
  return (
    <SettingsSection title={t("section")} description={t("sectionHint")} save={state}>
      {choice("size", ["s", "m", "l", "xl"])}
      {choice("color", ["white", "yellow"])}
      {choice("edge", ["shadow", "outline", "box"])}
      {choice("position", ["bottom", "raised"])}
      <div className="py-4">
        <SubtitlePreview style={style} label={t("preview")} sample={t("sample")} />
      </div>
    </SettingsSection>
  );
}

/**
 * The look on a frame of the picture's proportions (a stage, 3.5): a dark scene that lightens towards the bottom, so the
 * edge's part in reading it shows; the same CSS as the player's cues (globals.css `.subtitle-sample`).
 */
function SubtitlePreview({ style, label, sample }: { style: SubtitleStyle; label: string; sample: string }) {
  return (
    <figure
      aria-label={label}
      data-sub-size={style.size}
      data-sub-color={style.color}
      data-sub-edge={style.edge}
      data-sub-position={style.position}
      className="@container stage relative aspect-video w-full max-w-xl overflow-hidden rounded-sm bg-stage bg-linear-to-b from-stage via-surface-3 to-text-2"
    >
      <span className="subtitle-sample absolute inset-x-4 mx-auto w-fit text-center">{sample}</span>
    </figure>
  );
}

/**
 * Dubbing and voice-over studios in the order of preference: the known ones for the profile's audio languages (all of
 * them when none is set) and any other name typed in. Release search ranks them after the language.
 */
function StudiosSection({ value, change }: SectionProps) {
  const t = useTranslations("profiles");
  const ts = useTranslations("settings");
  const locale = useLocale();
  const { state, save } = useSettingsSave();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const audio = value.audioLanguages;
  const studios = VOICE_STUDIOS.filter((s) => audio.length === 0 || audio.includes(s.lang)).map((s) => ({
    value: s.name,
    label: s.name,
    keywords: [languageName(s.lang, locale) ?? s.lang, ...(s.anime ? [t("studiosAnime")] : [])],
  }));
  const apply = (voiceStudios: string[]) => {
    const c = change({ voiceStudios });
    void save(c.request, c.optimistic);
  };
  const addCustom = (e: FormEvent) => {
    e.preventDefault();
    const n = custom.trim();
    if (n.length < 2) return setError(t("studioShort"));
    if (value.voiceStudios.some((v) => v.toLowerCase() === n.toLowerCase())) return setError(t("studioTwice"));
    setError(null);
    setCustom("");
    apply([...value.voiceStudios, n]);
  };
  const full = value.voiceStudios.length >= 12;
  return (
    <SettingsSection title={ts("sectionStudios")} description={t("voiceStudiosHint")} save={state}>
      <SettingsRow label={t("voiceStudios")} description={t("voiceStudiosOrder")}>
        <div className="flex w-full flex-col gap-3 sm:w-80">
          <OrderedChoice
            value={value.voiceStudios}
            options={studios}
            max={12}
            addLabel={t("addStudio")}
            listLabel={t("voiceStudios")}
            onChange={apply}
          />
          {!full && (
            <form onSubmit={addCustom} className="flex flex-col gap-2" noValidate>
              <div className="flex gap-2">
                <Input
                  value={custom}
                  onChange={(e) => {
                    setCustom(e.target.value);
                    setError(null);
                  }}
                  placeholder={t("studioCustom")}
                  aria-label={t("studioCustom")}
                  aria-invalid={error ? true : undefined}
                  invalid={Boolean(error)}
                  maxLength={40}
                />
                <Button type="submit" variant="secondary">
                  {t("studioAdd")}
                </Button>
              </div>
              {error && (
                <p role="alert" className="text-caption font-medium text-danger">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      </SettingsRow>
    </SettingsSection>
  );
}

/** What Lumovio offers the profile (design-system 8.14): anime on or off. What's off is still found by name. */
function CatalogSection({ value, change }: SectionProps) {
  const t = useTranslations("profiles");
  const ts = useTranslations("settings");
  const { state, save } = useSettingsSave();
  return (
    <SettingsSection title={ts("sectionCatalog")} description={ts("sectionCatalogHint")} save={state}>
      <SettingsRow label={t("anime")} description={t("animeHint")}>
        <Switch
          hideLabel
          label={t("anime")}
          checked={value.showAnime}
          onCheckedChange={(showAnime) => {
            const c = change({ showAnime });
            void save(c.request, c.optimistic);
          }}
        />
      </SettingsRow>
    </SettingsSection>
  );
}

/** What of an unwatched episode stays hidden until pressed (design-system 8.12): stills, descriptions, names. */
function SpoilersSection({ value, change }: SectionProps) {
  const t = useTranslations("spoilers");
  const { state, save } = useSettingsSave();
  const parts = ["stills", "overviews", "names"] as const;
  return (
    <SettingsSection title={t("section")} description={t("sectionHint")} save={state}>
      {parts.map((k) => (
        <SettingsRow key={k} label={t(k)} description={t(`${k}Hint`)}>
          <Switch
            hideLabel
            label={t(k)}
            checked={value.spoilers[k]}
            onCheckedChange={(on) => {
              const c = change({ spoilers: { ...value.spoilers, [k]: on } });
              void save(c.request, c.optimistic);
            }}
          />
        </SettingsRow>
      ))}
    </SettingsSection>
  );
}

function QualitySection({ value, change }: SectionProps) {
  const t = useTranslations("profiles");
  const ts = useTranslations("settings");
  const { state, save } = useSettingsSave();
  return (
    <SettingsSection title={ts("sectionQuality")} description={t("releaseQualityIntro")} save={state}>
      <div className="py-4">
        <RadioGroup<Profile["releaseQuality"]>
          legend={t("releaseQuality")}
          hideLegend
          value={value.releaseQuality}
          onValueChange={(releaseQuality) => {
            const c = change({ releaseQuality });
            void save(c.request, c.optimistic);
          }}
          options={(["auto", "best", "small"] as const).map((m) => ({
            value: m,
            label: t(`releaseQuality_${m}`),
            description: t(`releaseQualityHint_${m}`),
          }))}
        />
      </div>
    </SettingsSection>
  );
}

/** The way to every profile's name, avatar, PIN, languages and region (an adult's; 8.10 hides it from a kids profile). */
function ProfilesSection() {
  const t = useTranslations("profiles");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  return (
    <SettingsSection title={t("sectionProfiles")}>
      <SettingsRow label={tn("manageProfiles")} description={t("manageHint")}>
        {/* "Done" there brings the person back to this page. */}
        <Link href={`/profiles?manage=1&next=${encodeURIComponent(pathname)}`} className={buttonClass("secondary")}>
          {tc("open")}
        </Link>
      </SettingsRow>
    </SettingsSection>
  );
}
