"use client";

import type { Profile, SubtitleStyle } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SaveError, SaveStatus, SettingsRow } from "@/components/ui/Settings";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";
import { ApiRequestError, api } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { languageName } from "@/lib/format";
import { DUBBING, isDubbing, VOICE_STUDIOS } from "@/lib/media/releases";
import { useSettingsSave } from "@/lib/use-action";
import { capital } from "./locale-options";
import { OrderedChoice } from "./OrderedChoice";
import type { ProfileChange, ProfilePrefs } from "./ProfileSettings";
import { useDiscardGuard } from "./use-unsaved";

/*
 * The profile's sub-screens: what the Profile page shows as a row with its value opens here, in a
 * dialog (a sheet on a phone) — the choices that need more room than a row. Each applies at once with "Saved" at the start
 * of the dialog's actions; "Done" closes it.
 * The public page is a form: it waits for "Save" and asks before its
 * changes are dropped. Loaded when one is opened (bundle budget: the combobox, the studios and the preview come with it).
 */

export const MEDIA_LANGS = ["en", "uk", "ru", "es", "de", "fr", "pt", "it", "pl", "tr", "ja", "ko", "zh", "ar", "hi", "id"];

type Common = { value: ProfilePrefs; change: ProfileChange; onClose: () => void };

/** A sub-screen that applies at once: its body, then "Saved" and "Done". */
function Applied({ title, onClose, save, size, children }: { title: string; onClose: () => void; save: ReturnType<typeof useSettingsSave>; size?: "sm" | "lg"; children: ReactNode }) {
  const tc = useTranslations("common");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title} size={size ?? "sm"}>
      <SaveError save={save.state} className="mb-4" />
      <div className="flex flex-col gap-6">{children}</div>
      <DialogActions className="md:items-center">
        <SaveStatus save={save.state} className="md:me-auto max-md:justify-center" />
        <Button onClick={onClose}>{tc("done")}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** A part of a sub-screen with a small heading (as a group's), the heading naming what's under it for a screen reader. */
function Part({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-body-s font-semibold text-text-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function useLanguageOptions() {
  const locale = useLocale();
  return MEDIA_LANGS.map((l) => ({
    value: l,
    label: capital(languageName(l, locale) ?? l, locale),
    keywords: [l, languageName(l, l) ?? ""],
  }));
}

/**
 * Audio: the languages in the order of preference, then (an adult's) the dubbing and voice-over studios — the known ones
 * for those languages (all of them when none is set) and any other name typed in. Release search ranks studios after the
 * language.
 */
export function AudioDialog({ value, change, onClose, kids }: Common & { kids: boolean }) {
  const t = useTranslations("profiles");
  const tt = useTranslations("title");
  const ts = useTranslations("settings");
  const locale = useLocale();
  const save = useSettingsSave();
  const langs = useLanguageOptions();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const apply = (patch: Partial<ProfilePrefs>) => {
    const c = change(patch);
    void save.save(c.request, c.optimistic);
  };
  const audio = value.audioLanguages;
  // "Dubbing" first: any studio's dub as one entry of the order ("1 — Dubbing, 2 — LostFilm").
  const studios = [
    { value: DUBBING, label: tt("voice_dub").charAt(0).toUpperCase() + tt("voice_dub").slice(1), keywords: ["dub", "dubbing"] },
    ...VOICE_STUDIOS.filter((s) => audio.length === 0 || audio.includes(s.lang)).map((s) => ({
      value: s.name,
      label: s.name,
      keywords: [languageName(s.lang, locale) ?? s.lang, ...(s.anime ? [t("studiosAnime")] : [])],
    })),
  ];
  const addCustom = (e: FormEvent) => {
    e.preventDefault();
    // "Дубляж" typed by hand is the "Dubbing" entry.
    const n = isDubbing(custom) ? DUBBING : custom.trim();
    if (n.length < 2) return setError(t("studioShort"));
    if (value.voiceStudios.some((v) => v.toLowerCase() === n.toLowerCase() || (isDubbing(v) && isDubbing(n)))) return setError(t("studioTwice"));
    setError(null);
    setCustom("");
    apply({ voiceStudios: [...value.voiceStudios, n] });
  };
  const full = value.voiceStudios.length >= 12;
  return (
    <Applied title={ts("audioRow")} onClose={onClose} save={save}>
      <Part title={ts("languagesPart")}>
        <p className="sr-only">{t("audioLanguagesOrder")}</p>
        <OrderedChoice
          value={value.audioLanguages}
          options={langs}
          max={8}
          addLabel={t("addLanguage")}
          listLabel={t("audioLanguages")}
          onChange={(audioLanguages) => apply({ audioLanguages })}
        />
      </Part>
      {!kids && (
        <Part title={ts("sectionStudios")}>
          <p className="sr-only">{t("voiceStudiosHint")}</p>
          <OrderedChoice value={value.voiceStudios} options={studios} max={12} addLabel={t("addStudio")} listLabel={t("voiceStudios")} onChange={(voiceStudios) => apply({ voiceStudios })} />
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
                <Button type="submit" variant="secondary" disabled={!custom.trim()}>
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
        </Part>
      )}
    </Applied>
  );
}

/** Subtitles: the languages in the order of preference. */
export function SubtitlesDialog({ value, change, onClose }: Common) {
  const t = useTranslations("profiles");
  const ts = useTranslations("settings");
  const save = useSettingsSave();
  const langs = useLanguageOptions();
  return (
    <Applied title={ts("subtitlesRow")} onClose={onClose} save={save}>
      <p className="sr-only">{t("subtitleLanguagesOrder")}</p>
      <OrderedChoice
        value={value.subtitleLanguages}
        options={langs}
        max={8}
        addLabel={t("addLanguage")}
        listLabel={t("subtitleLanguages")}
        onChange={(subtitleLanguages) => {
          const c = change({ subtitleLanguages });
          void save.save(c.request, c.optimistic);
        }}
      />
    </Applied>
  );
}

/**
 * How subtitles look in the player: size, text colour, background, position — and the preview on a
 * frame of the picture's proportions that follows each choice. A kids profile has it too.
 */
export function SubtitleStyleDialog({ value, change, onClose }: Common) {
  const t = useTranslations("subtitles");
  const save = useSettingsSave();
  const style = value.subtitleStyle;
  const apply = (patch: Partial<SubtitleStyle>) => {
    const c = change({ subtitleStyle: { ...style, ...patch } });
    void save.save(c.request, c.optimistic);
  };
  const choice = <K extends keyof SubtitleStyle>(key: K, options: readonly SubtitleStyle[K][]) => {
    const name: string = key;
    return (
      <SettingsRow label={t(name)} className="py-1">
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
    <Applied title={t("section")} onClose={onClose} save={save} size="lg">
      <p className="sr-only">{t("sectionHint")}</p>
      <SubtitlePreview style={style} label={t("preview")} sample={t("sample")} />
      <div className="flex flex-col">
        {choice("size", ["s", "m", "l", "xl"])}
        {choice("color", ["white", "yellow"])}
        {choice("edge", ["shadow", "outline", "box"])}
        {choice("position", ["bottom", "raised"])}
      </div>
    </Applied>
  );
}

/**
 * The look on a frame of the picture's proportions (a stage): a dark scene that lightens towards the bottom,
 * so the edge's part in reading it shows; the same CSS as the player's cues (globals.css `.subtitle-sample`).
 */
function SubtitlePreview({ style, label, sample }: { style: SubtitleStyle; label: string; sample: string }) {
  return (
    <figure
      aria-label={label}
      data-sub-size={style.size}
      data-sub-color={style.color}
      data-sub-edge={style.edge}
      data-sub-position={style.position}
      className="@container stage relative mx-auto aspect-video w-full max-w-sm overflow-hidden rounded-sm bg-stage bg-linear-to-b from-stage via-surface-3 to-text-2"
    >
      <span className="subtitle-sample absolute inset-x-4 mx-auto w-fit text-center">{sample}</span>
    </figure>
  );
}

export type PublicPage = { handle: string | null; isPublic: boolean; showFavorites: boolean; showRatings: boolean; bio: string | null };

const HANDLE = /^[a-z0-9_]{3,24}$/;

/**
 * The profile's public page as one form: the name and "about", whether the page is open and what it
 * shows — kept as typed and checked on "Save", with the reason at the field; the address shown is the page's real one
 * (/u/…). Closing it with changes asks first. Showing favourites and ratings waits for the page to be open.
 */
export function PublicPageDialog({ profile, initial, onClose }: { profile: Profile; initial: PublicPage; onClose: () => void }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const qc = useQueryClient();
  const ids = useId();
  const [draft, setDraft] = useState({ ...initial, handle: initial.handle ?? "", bio: initial.bio ?? "" });
  const [errors, setErrors] = useState<{ handle?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const dirty =
    draft.handle.trim() !== (initial.handle ?? "") ||
    draft.bio.trim() !== (initial.bio ?? "") ||
    draft.isPublic !== initial.isPublic ||
    draft.showFavorites !== initial.showFavorites ||
    draft.showRatings !== initial.showRatings;
  const close = useDiscardGuard(dirty, onClose);
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const h = draft.handle.trim();
    // Checked as typed, never rewritten silently: the reason is said at the field.
    if (h && !HANDLE.test(h)) return setErrors({ handle: t("handleInvalid") });
    if (!h && draft.isPublic) return setErrors({ handle: t("handleNeeded") });
    setErrors({});
    setBusy(true);
    const next: PublicPage = { ...draft, handle: h || null, bio: draft.bio.trim() || null };
    try {
      await api(`/api/profiles/${profile.id}/public`, { method: "PUT", json: next });
      qc.setQueryData(["public-settings", profile.id], next);
      toast.success(tc("saved"));
      onClose();
    } catch (err) {
      const field =
        err instanceof ApiRequestError && err.code === "conflict"
          ? t("handleTaken")
          : err instanceof ApiRequestError && err.code === "bad_request"
            ? t("handleFirst")
            : null;
      setErrors(field ? { handle: field } : { form: tr(apiErrorKey(err)) });
    } finally {
      setBusy(false);
    }
  };
  const open = draft.isPublic;
  const address = initial.isPublic && initial.handle ? `/u/${initial.handle}` : null;

  return (
    <Dialog open onOpenChange={(o) => !o && void close()} title={t("publicSwitch")} size="sm">
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <p className="sr-only">{t("publicProfileHint")}</p>
        <div className="flex flex-col divide-y divide-line">
          <SettingsRow label={t("publicSwitch")} htmlFor={`${ids}-public`} className="py-2">
            <Switch id={`${ids}-public`} hideLabel label={t("publicSwitch")} checked={draft.isPublic} onCheckedChange={(v) => set({ isPublic: v })} />
          </SettingsRow>
          <SettingsRow label={t("showFavorites")} description={open ? undefined : t("needsPublic")} htmlFor={`${ids}-fav`} className="py-2">
            <Switch id={`${ids}-fav`} hideLabel label={t("showFavorites")} checked={draft.showFavorites} disabled={!open} onCheckedChange={(v) => set({ showFavorites: v })} />
          </SettingsRow>
          <SettingsRow label={t("showRatings")} description={open ? undefined : t("needsPublic")} htmlFor={`${ids}-ratings`} className="py-2">
            <Switch id={`${ids}-ratings`} hideLabel label={t("showRatings")} checked={draft.showRatings} disabled={!open} onCheckedChange={(v) => set({ showRatings: v })} />
          </SettingsRow>
        </div>
        <Field label={t("handle")} hint={t("handleHint")} error={errors.handle}>
          {(id, d, invalid) => (
            <Input id={id} aria-describedby={d} invalid={invalid} value={draft.handle} maxLength={24} autoComplete="off" spellCheck={false} onChange={(e) => set({ handle: e.target.value })} />
          )}
        </Field>
        <Field label={t("bio")} hint={t("bioHint")}>
          {(id, d) => <Input id={id} aria-describedby={d} value={draft.bio} maxLength={280} onChange={(e) => set({ bio: e.target.value })} />}
        </Field>
        {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
        {address && !dirty && (
          <Link variant="action" arrow href={address}>
            {t("openPublic")}
          </Link>
        )}
        <DialogActions className="mt-2">
          <Button variant="secondary" disabled={busy} onClick={() => void close()}>
            {tc("cancel")}
          </Button>
          {/* Off until something is changed. */}
          <Button type="submit" loading={busy} disabled={!dirty}>
            {tc("save")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
