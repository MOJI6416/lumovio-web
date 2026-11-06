"use client";

import type { Profile } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { Combobox } from "@/components/ui/Combobox";
import { Select } from "@/components/ui/Select";
import { SettingsLink, SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { usePathname, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { languageName } from "@/lib/format";
import { SUBTITLE_DEFAULTS } from "@/lib/media/subs/view";
import { useSettingsSave } from "@/lib/use-action";
import { AUTO, capital, useLocaleOptions } from "./locale-options";
import type { PublicPage } from "./ProfileDialogs";

// The sub-screens load when one is opened (bundle budget): the ordered choice, the studios, the preview, the form.
const AudioDialog = dynamic(() => import("./ProfileDialogs").then((m) => m.AudioDialog), { ssr: false });
const SubtitlesDialog = dynamic(() => import("./ProfileDialogs").then((m) => m.SubtitlesDialog), { ssr: false });
const SubtitleStyleDialog = dynamic(() => import("./ProfileDialogs").then((m) => m.SubtitleStyleDialog), { ssr: false });
const PublicPageDialog = dynamic(() => import("./ProfileDialogs").then((m) => m.PublicPageDialog), { ssr: false });

export type ProfilePrefs = Pick<
  Profile,
  "uiLocale" | "metadataLocale" | "region" | "audioLanguages" | "subtitleLanguages" | "subtitleStyle" | "voiceStudios" | "releaseQuality" | "spoilers" | "showAnime"
>;
/** The request and the optimistic change for `save` of a group's or a sub-screen's useSettingsSave (8.8). */
export type ProfileChange = (patch: Partial<ProfilePrefs>) => { request: () => Promise<void>; optimistic: () => () => void };

const pick = (p: Profile): ProfilePrefs => ({
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

type Open = "audio" | "subtitles" | "style" | "public" | null;

/**
 * Settings → Profile (S14, design-system 7.18, 8.8; audit SET-01, SET-02, PRF-13): the active profile's own choices as
 * a short page that says what is chosen — Language and region (the interface language here is the profile's, the one
 * the site switches to), Audio and subtitles (rows with their values: audio, subtitles and their look open sub-screens;
 * the release quality is chosen in the row), Catalog, Spoilers, the public page and the way to every profile. Every choice
 * applies at once with "Saved" by its group's title or in its sub-screen; a refusal puts it back with "Retry". A kids
 * profile keeps its languages, audio, subtitles and spoilers — not the region or anime (an adult sets them in Manage
 * profiles), studios, quality or a public page.
 */
export function ProfileSettings() {
  const { me } = useSession();
  const p = me?.activeProfile;
  const router = useRouter();
  const [value, setValue] = useState<ProfilePrefs | null>(p ? pick(p) : null);
  const [open, setOpen] = useState<Open>(null);
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

  const change: ProfileChange = (patch) => ({
    request: async () => {
      await api(`/api/profiles/${p.id}`, { method: "PATCH", json: patch });
      // The rest of the site reads the profile from the session: bring it up to date.
      router.refresh();
    },
    optimistic: () => {
      const cur = latest.current!;
      const before = Object.fromEntries(Object.keys(patch).map((k) => [k, cur[k as keyof ProfilePrefs]])) as Partial<ProfilePrefs>;
      setValue((v) => v && { ...v, ...patch });
      return () => setValue((v) => v && { ...v, ...before });
    },
  });
  const section = { value, change, kids: p.isKids };
  const close = () => setOpen(null);

  return (
    <div className="space-y-8">
      <LanguageSection {...section} />
      <WatchSection {...section} onOpen={setOpen} />
      {!p.isKids && <CatalogSection {...section} />}
      <SpoilersSection {...section} />
      {/* The profile as others see it and the way to every profile: one group, without a title of its own. */}
      {!p.isKids && (
        <SettingsSection>
          <PublicRow profile={p} onOpen={() => setOpen("public")} />
          <ProfilesRow />
        </SettingsSection>
      )}
      {open === "audio" && <AudioDialog value={value} change={change} kids={p.isKids} onClose={close} />}
      {open === "subtitles" && <SubtitlesDialog value={value} change={change} onClose={close} />}
      {open === "style" && <SubtitleStyleDialog value={value} change={change} onClose={close} />}
      {open === "public" && <PublicDialog profile={p} onClose={close} />}
    </div>
  );
}

type SectionProps = { value: ProfilePrefs; change: ProfileChange; kids: boolean };

function LanguageSection({ value, change, kids }: SectionProps) {
  const t = useTranslations("profiles");
  const ts = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const options = useLocaleOptions();
  const { state, save } = useSettingsSave();
  const ids = useId();
  const apply = async (patch: Partial<ProfilePrefs>) => {
    const c = change(patch);
    return save(c.request, c.optimistic);
  };
  return (
    <SettingsSection title={kids ? ts("sectionLanguageKids") : ts("sectionLanguage")} save={state}>
      <SettingsRow label={ts("interfaceLanguage")} description={t("uiLanguageProfileHint")} htmlFor={`${ids}-ui`}>
        <Select
          id={`${ids}-ui`}
          size="sm"
          className="sm:w-56"
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
          size="sm"
          className="sm:w-56"
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
            size="sm"
            className="sm:w-56"
            value={value.region ?? AUTO}
            onValueChange={(v) => void apply({ region: v === AUTO ? null : v })}
            options={options.region}
          />
        </SettingsRow>
      )}
    </SettingsSection>
  );
}

/** "Ukrainian, English" — the chosen languages in their order, or "Not chosen". */
function useLanguageList() {
  const ts = useTranslations("settings");
  const locale = useLocale();
  return (codes: string[]) => (codes.length ? codes.map((c) => capital(languageName(c, locale) ?? c, locale)).join(", ") : ts("notChosen"));
}

/**
 * What the profile hears and reads (7.18): audio and subtitles — the languages in order, the studios — and the subtitles'
 * look are rows with their values that open sub-screens; the release quality is a short choice right in its row.
 */
function WatchSection({ value, change, kids, onOpen }: SectionProps & { onOpen: (o: Open) => void }) {
  const t = useTranslations("profiles");
  const ts = useTranslations("settings");
  const tsub = useTranslations("subtitles");
  const { state, save } = useSettingsSave();
  const list = useLanguageList();
  const ids = useId();
  const style = value.subtitleStyle;
  const audio = list(value.audioLanguages);
  return (
    <SettingsSection title={ts("sectionAudio")} save={state}>
      <SettingsLink
        label={ts("audioRow")}
        value={<span className="truncate">{kids || value.voiceStudios.length === 0 ? audio : `${audio} · ${value.voiceStudios.join(", ")}`}</span>}
        description={t("audioLanguagesOrder")}
        opens
        onClick={() => onOpen("audio")}
      />
      <SettingsLink
        label={ts("subtitlesRow")}
        value={<span className="truncate">{list(value.subtitleLanguages)}</span>}
        description={t("subtitleLanguagesOrder")}
        opens
        onClick={() => onOpen("subtitles")}
      />
      <SettingsLink
        label={tsub("section")}
        value={<span className="truncate">{`${tsub(`size_${style.size}`)} · ${tsub(`color_${style.color}`)}`}</span>}
        description={tsub("sectionHint")}
        opens
        onClick={() => onOpen("style")}
      />
      {!kids && (
        <SettingsRow inline label={ts("sectionQuality")} description={t("releaseQualityIntro")} htmlFor={`${ids}-quality`}>
          <Select<Profile["releaseQuality"]>
            id={`${ids}-quality`}
            size="sm"
            className="w-40 sm:w-56"
            value={value.releaseQuality}
            onValueChange={(releaseQuality) => {
              const c = change({ releaseQuality });
              void save(c.request, c.optimistic);
            }}
            options={(["auto", "best", "small"] as const).map((m) => ({ value: m, label: t(`releaseQuality_${m}`) }))}
          />
        </SettingsRow>
      )}
    </SettingsSection>
  );
}

/** What Lumovio offers the profile (design-system 8.14): anime on or off. What's off is still found by name. */
function CatalogSection({ value, change }: SectionProps) {
  const t = useTranslations("profiles");
  const ts = useTranslations("settings");
  const { state, save } = useSettingsSave();
  const ids = useId();
  return (
    <SettingsSection title={ts("sectionCatalog")} description={ts("sectionCatalogHint")} save={state}>
      <SettingsRow label={t("anime")} description={t("animeHint")} htmlFor={`${ids}-anime`}>
        <Switch
          id={`${ids}-anime`}
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
  const ids = useId();
  const parts = ["stills", "overviews", "names"] as const;
  return (
    <SettingsSection title={t("section")} description={t("sectionHint")} save={state}>
      {parts.map((k) => (
        <SettingsRow key={k} label={t(k)} description={t(`${k}Hint`)} htmlFor={`${ids}-${k}`}>
          <Switch
            id={`${ids}-${k}`}
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

const publicKey = (id: string) => ["public-settings", id];

/** The profile's public page as a row with its state — closed, or its address — opening the form (an adult's). */
function PublicRow({ profile, onOpen }: { profile: Profile; onOpen: () => void }) {
  const t = useTranslations("settings");
  const q = useQuery({ queryKey: publicKey(profile.id), queryFn: () => api<PublicPage>(`/api/profiles/${profile.id}/public`) });
  const d = q.data;
  return (
    <SettingsLink
        label={t("publicSwitch")}
        value={
          d ? (
            <span className="truncate">{d.isPublic && d.handle ? `lumovio.app/u/${d.handle}` : t("publicClosed")}</span>
          ) : q.isError ? (
            t("publicProfileLoadError")
          ) : (
            <Skeleton shape="xs" className="h-4 w-24" />
          )
        }
        description={t("publicProfileHint")}
        opens
        disabled={!d}
        onClick={onOpen}
      />
  );
}

/** The form opens on what the page has now. */
function PublicDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const q = useQuery({ queryKey: publicKey(profile.id), queryFn: () => api<PublicPage>(`/api/profiles/${profile.id}/public`) });
  if (!q.data) return null;
  return <PublicPageDialog profile={profile} initial={q.data} onClose={onClose} />;
}

/** The way to every profile's name, avatar, PIN, languages and region (an adult's; 8.10 hides it from a kids profile). */
function ProfilesRow() {
  const tn = useTranslations("nav");
  const t = useTranslations("profiles");
  const pathname = usePathname();
  // "Done" there brings the person back to this page.
  return <SettingsLink href={`/profiles?manage=1&next=${encodeURIComponent(pathname)}`} label={tn("manageProfiles")} description={t("manageHint")} />;
}
