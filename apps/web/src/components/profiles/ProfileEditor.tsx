"use client";

import type { AvatarColor, AvatarMark, MaturityLevel, Profile } from "@lumovio/contracts";
import { clsx } from "clsx";
import { Check, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FocusEvent, type FormEvent, type Ref, useId, useRef, useState } from "react";
import { AUTO, useLocaleOptions } from "@/components/settings/locale-options";
import { AVATAR_COLORS, avatarOf, avatarParts, ProfileAvatar } from "@/components/ui/Avatar";
import { AVATAR_MARK_IDS } from "@/components/ui/avatar-marks";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { peerFocusRing } from "@/components/ui/styles";
import { Switch } from "@/components/ui/Switch";
import { api } from "@/lib/api";
import { isPinError, profileErrorText } from "./profile-errors";

type PinMode = "keep" | "change" | "remove";

/**
 * One avatar option as a native radio (arrows move and choose, Tab leaves the group, as ui/RadioGroup): the avatar it
 * gives, the selection ring and its check.
 */
function AvatarOption(props: { group: string; value: string; checked: boolean; onChange: () => void; label: string; avatar: string; name: string }) {
  return (
    <label className="relative block cursor-pointer">
      <input type="radio" name={props.group} value={props.value} checked={props.checked} onChange={props.onChange} aria-label={props.label} className="peer sr-only" />
      <span className={clsx("block rounded-avatar p-0.5 transition", peerFocusRing, props.checked ? "ring-3 ring-selected-bg" : "opacity-80 hover:opacity-100")}>
        <ProfileAvatar avatar={props.avatar} name={props.name} size={44} className="!h-auto !w-full aspect-square" />
      </span>
      {props.checked && (
        <span aria-hidden className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-selected-bg text-selected-fg">
          <Check className="size-3.5" />
        </span>
      )}
    </label>
  );
}
const PIN = /^\d{4,8}$/;

/** A digit field for a PIN: hidden figures, the phone's number pad. */
function PinInput(props: {
  id: string;
  describedBy?: string;
  invalid: boolean;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
}) {
  return (
    <Input
      ref={props.inputRef}
      onFocus={props.onFocus}
      id={props.id}
      aria-describedby={props.describedBy}
      invalid={props.invalid}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={props.autoFocus}
      maxLength={8}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value.replace(/[^0-9]/g, ""))}
      className="tracking-widest sm:w-40"
    />
  );
}

/**
 * The profile editor of Manage profiles (design-system 7.17, 7.9; audit PRF-07, PRF-08, PRF-09, PRF-13): name, an
 * avatar that tells profiles apart — a colour (a free one offered first) and a white mark or the name's letter — kids
 * profile and age level, anime on or off (8.14), the profile's languages and region — an adult sets them for any profile, a kids one
 * included — and its PIN (set, change, remove). Deleting is in the danger zone at the end, confirmed in a dialog that
 * asks for the PIN when there is one. Errors are said at their field, in the person's language.
 */
export function ProfileEditor({
  profile,
  taken,
  canDelete,
  focusPin = false,
  onClose,
  onSaved,
}: {
  profile: Profile | null;
  /** The avatars other profiles use: a new profile starts with a free colour and a mark none of them has. */
  taken: string[];
  canDelete: boolean;
  /** Opened by "Set PIN" (8.10): the focus starts in the PIN field, scrolled into view, not in the name. */
  focusPin?: boolean;
  onClose: () => void;
  onSaved: (p: Profile, how: "created" | "saved" | "deleted") => void;
}) {
  const t = useTranslations("profiles");
  const tc = useTranslations("common");
  const ids = useId();
  const pinField = useRef<HTMLInputElement>(null);
  // The dialog focuses without scrolling; the PIN field sits below the languages, so bring it into view.
  const showPinField = focusPin ? (e: FocusEvent<HTMLInputElement>) => e.currentTarget.scrollIntoView({ block: "center" }) : undefined;
  const options = useLocaleOptions();
  const [name, setName] = useState(profile?.name ?? "");
  const others = taken.map(avatarParts);
  const [color, setColor] = useState<AvatarColor>(() =>
    profile
      ? avatarParts(profile.avatar).color
      : (AVATAR_COLORS.find((c) => !others.some((o) => o.color === c)) ?? AVATAR_COLORS[taken.length % AVATAR_COLORS.length]!),
  );
  const [mark, setMark] = useState<AvatarMark | null>(() =>
    profile
      ? avatarParts(profile.avatar).mark
      : (AVATAR_MARK_IDS.find((m) => !others.some((o) => o.mark === m)) ?? AVATAR_MARK_IDS[taken.length % AVATAR_MARK_IDS.length]!),
  );
  const avatar = avatarOf(color, mark);
  const ownColor = profile ? avatarParts(profile.avatar).color : null;
  const [isKids, setIsKids] = useState(profile?.isKids ?? false);
  const [maturity, setMaturity] = useState<MaturityLevel>(profile?.maturity ?? "adult");
  const [showAnime, setShowAnime] = useState(profile?.showAnime ?? true);
  const [uiLocale, setUiLocale] = useState(profile?.uiLocale ?? null);
  const [metadataLocale, setMetadataLocale] = useState(profile?.metadataLocale ?? null);
  const [region, setRegion] = useState(profile?.region ?? null);
  const [pinMode, setPinMode] = useState<PinMode>("keep");
  const [pin, setPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [errors, setErrors] = useState<{ name?: string; pin?: string; currentPin?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const kids = profile ? profile.isKids : isKids;
  const hasPin = profile?.hasPin ?? false;
  const maturities: MaturityLevel[] = ["kids", "family", "teen", ...(kids ? [] : (["adult"] as const))];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    // Checked on submit, said at the field (one model for every form, AUTH-04).
    // A new PIN: typed into the empty field (no PIN yet) or asked for with "Change PIN".
    const settingPin = hasPin ? pinMode === "change" : pin.length > 0;
    const found = {
      name: name.trim() ? undefined : t("nameMissing"),
      pin: settingPin && !PIN.test(pin) ? t("pinFormat") : undefined,
      currentPin: hasPin && pinMode !== "keep" && !currentPin ? t("enterCurrentPin") : undefined,
    };
    setErrors(found);
    if (found.name || found.pin || found.currentPin) return;
    setBusy(true);
    const level: MaturityLevel = kids && maturity === "adult" ? "kids" : maturity;
    const locales = { uiLocale, metadataLocale, region };
    try {
      let p: Profile;
      if (profile) {
        // The PIN first: it is what can be refused (a wrong current PIN), and then nothing else has changed yet.
        if (hasPin && pinMode !== "keep") await api(`/api/profiles/${profile.id}/pin`, { method: "PUT", json: { pin: pinMode === "change" ? pin : null, currentPin } });
        if (!hasPin && pin) await api(`/api/profiles/${profile.id}/pin`, { method: "PUT", json: { pin } });
        p = await api<Profile>(`/api/profiles/${profile.id}`, { method: "PATCH", json: { name: name.trim(), avatar, maturity: level, showAnime, ...locales } });
        p = { ...p, hasPin: hasPin ? pinMode !== "remove" : pin.length > 0 };
        onSaved(p, "saved");
      } else {
        p = await api<Profile>("/api/profiles", { method: "POST", json: { name: name.trim(), avatar, isKids, maturity: level, showAnime } });
        if (uiLocale || metadataLocale || region) p = await api<Profile>(`/api/profiles/${p.id}`, { method: "PATCH", json: locales });
        if (pin) {
          await api(`/api/profiles/${p.id}/pin`, { method: "PUT", json: { pin } });
          p = { ...p, hasPin: true };
        }
        onSaved(p, "created");
      }
    } catch (err) {
      if (isPinError(err) && profile) setErrors({ currentPin: profileErrorText(t, err, "pin") });
      else setErrors({ form: profileErrorText(t, err, "save") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog
        open={!deleting}
        onOpenChange={(o) => !o && !deleting && onClose()}
        title={profile ? t("editNamed", { name: profile.name }) : t("add")}
        size="md"
        initialFocus={focusPin && profile && !hasPin ? pinField : undefined}
      >
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-6 text-start" noValidate>
          <Field label={t("name")} error={errors.name}>
            {(id, d, invalid) => (
              <Input id={id} aria-describedby={d} invalid={invalid} autoFocus={!focusPin} value={name} onChange={(e) => {
                  setName(e.target.value);
                  setErrors((x) => ({ ...x, name: undefined }));
                }} maxLength={40} autoComplete="off" />
            )}
          </Field>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 text-body-s font-semibold text-text-1">{t("avatar")}</legend>
            {/* The colour, then the mark on it (7.17): two radio groups, each a Tab stop. */}
            <fieldset>
              <legend className="mb-2 text-caption font-semibold text-text-2">{t("avatarColor")}</legend>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_COLORS.map((c, i) => (
                  <AvatarOption
                    key={c}
                    group={`${ids}-color`}
                    value={c}
                    checked={color === c}
                    onChange={() => setColor(c)}
                    // "Colour 3 · used by another profile", not the palette name ("aurora", X-21).
                    label={others.some((o) => o.color === c) && c !== ownColor ? t("avatarOptionTaken", { n: i + 1 }) : t("avatarOption", { n: i + 1 })}
                    avatar={avatarOf(c, mark)}
                    name={name}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-caption font-semibold text-text-2">{t("avatarMark")}</legend>
              <div className="grid grid-cols-6 gap-2">
                {/* The letter: the name's initial — "A" before a name is typed, so the option isn't a bare colour. */}
                <AvatarOption group={`${ids}-mark`} value="" checked={mark === null} onChange={() => setMark(null)} label={t("markLetter")} avatar={color} name={name.trim() || "A"} />
                {AVATAR_MARK_IDS.map((m) => (
                  <AvatarOption
                    key={m}
                    group={`${ids}-mark`}
                    value={m}
                    checked={mark === m}
                    onChange={() => setMark(m)}
                    label={t("markOption", { mark: t(`mark_${m}`) })}
                    avatar={avatarOf(color, m)}
                    name={name}
                  />
                ))}
              </div>
            </fieldset>
            <p className="text-caption font-medium text-text-3">{t("avatarHint")}</p>
          </fieldset>

          <div className="flex flex-col gap-4">
            {profile ? (
              kids && (
                <p className="flex flex-wrap items-center gap-2 text-body-s text-text-2">
                  <Tag>{t("kidsTag")}</Tag>
                  {t("kidsHintShort")}
                </p>
              )
            ) : (
              <Switch
                checked={isKids}
                onCheckedChange={(v) => {
                  setIsKids(v);
                  if (v && maturity === "adult") setMaturity("kids");
                }}
                label={t("kids")}
                description={t("kidsHint")}
              />
            )}
            <Field label={t("maturity")} hint={kids ? t("maturityKidsHint") : undefined}>
              {(id, d) => (
                <Select<MaturityLevel>
                  id={id}
                  aria-describedby={d}
                  value={kids && maturity === "adult" ? "kids" : maturity}
                  onValueChange={setMaturity}
                  options={maturities.map((m) => ({ value: m, label: t(`maturity_${m}`) }))}
                />
              )}
            </Field>
            {/* An adult sets it for any profile; a kids one doesn't change it itself (8.14). */}
            <Switch checked={showAnime} onCheckedChange={setShowAnime} label={t("anime")} description={t("animeHint")} />
          </div>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-h3 text-text-1">{t("languagesSection")}</legend>
            <Field label={t("uiLanguageProfile")} hint={t("uiLanguageProfileHintShort")}>
              {(id, d) => (
                <Select id={id} aria-describedby={d} value={uiLocale ?? AUTO} onValueChange={(v) => setUiLocale(v === AUTO ? null : v)} options={options.ui(uiLocale)} />
              )}
            </Field>
            <Field label={t("metadataLanguage")}>
              {(id) => <Combobox id={id} value={metadataLocale ?? AUTO} onValueChange={(v) => setMetadataLocale(v === AUTO ? null : v)} options={options.metadata} />}
            </Field>
            {/* An adult sets the region of any profile: a kids profile can't change it itself (PRF-13). */}
            <Field label={t("region")} hint={kids ? t("regionKidsHint") : t("regionHint")}>
              {(id, d) => <Combobox id={id} aria-describedby={d} value={region ?? AUTO} onValueChange={(v) => setRegion(v === AUTO ? null : v)} options={options.region} />}
            </Field>
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-h3 text-text-1">{t("pinSection")}</legend>
            {!profile || !hasPin ? (
              <Field label={t("pinOptional")} hint={t("pinHint")} error={errors.pin}>
                {(id, d, invalid) => (
                  <PinInput
                    id={id}
                    describedBy={d}
                    invalid={invalid}
                    value={pin}
                    onChange={(v) => {
                      setPin(v);
                      setErrors((x) => ({ ...x, pin: undefined }));
                    }}
                    inputRef={pinField}
                    onFocus={showPinField}
                  />
                )}
              </Field>
            ) : pinMode === "keep" ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="me-auto text-body text-text-2">{t("pinIsSet")}</p>
                <Button variant="secondary" size="sm" onClick={() => setPinMode("change")}>
                  {t("changePin")}
                </Button>
                <Button variant="tertiary" size="sm" onClick={() => setPinMode("remove")}>
                  {t("removePin")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Field label={t("currentPin")} hint={pinMode === "remove" ? t("removePinHint") : undefined} error={errors.currentPin}>
                  {(id, d, invalid) => <PinInput id={id} describedBy={d} invalid={invalid} value={currentPin} onChange={(v) => { setCurrentPin(v); setErrors((x) => ({ ...x, currentPin: undefined })); }} autoFocus />}
                </Field>
                {pinMode === "change" && (
                  <Field label={t("newPin")} hint={t("pinHint")} error={errors.pin}>
                    {(id, d, invalid) => <PinInput id={id} describedBy={d} invalid={invalid} value={pin} onChange={(v) => { setPin(v); setErrors((x) => ({ ...x, pin: undefined })); }} />}
                  </Field>
                )}
                <Button
                  variant="tertiary"
                  size="sm"
                  className="-ms-3 self-start"
                  onClick={() => {
                    setPinMode("keep");
                    setPin("");
                    setCurrentPin("");
                    setErrors((e) => ({ ...e, pin: undefined, currentPin: undefined }));
                  }}
                >
                  {t("keepPin")}
                </Button>
              </div>
            )}
          </fieldset>

          {profile && canDelete && (
            <section aria-labelledby={`${ids}-danger`} className="flex flex-col gap-2 border-t border-line pt-4">
              <h3 id={`${ids}-danger`} className="text-h3 text-text-1">
                {t("dangerZone")}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <p className="me-auto max-w-sm text-body-s text-text-2">{t("deleteConfirm", { name: profile.name })}</p>
                <Button variant="danger-tertiary" icon={Trash2} onClick={() => setDeleting(true)}>
                  {t("deleteProfile")}
                </Button>
              </div>
            </section>
          )}

          {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
          <DialogActions className="mt-0">
            <Button variant="secondary" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {profile ? tc("save") : t("create")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {profile && deleting && (
        <DeleteProfile
          profile={profile}
          onCancel={() => setDeleting(false)}
          onDeleted={() => onSaved(profile, "deleted")}
        />
      )}
    </>
  );
}

/**
 * «Delete profile "Anya"?» (7.9, PRF-07): what goes with it, the PIN field when the profile has one, "Cancel" and a red
 * "Delete profile". A wrong PIN is said at the field and the dialog stays.
 */
function DeleteProfile({ profile, onCancel, onDeleted }: { profile: Profile; onCancel: () => void; onDeleted: () => void }) {
  const t = useTranslations("profiles");
  const tc = useTranslations("common");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<{ pin?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (profile.hasPin && !PIN.test(pin)) return setError({ pin: pin ? t("pinFormat") : t("enterCurrentPin") });
    setBusy(true);
    setError({});
    try {
      await api(`/api/profiles/${profile.id}`, { method: "DELETE", json: { pin: profile.hasPin ? pin : undefined } });
      onDeleted();
    } catch (err) {
      setBusy(false);
      if (isPinError(err)) setError({ pin: profileErrorText(t, err, "pin") });
      else setError({ form: profileErrorText(t, err, "delete") });
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onCancel()} title={t("deleteTitle", { name: profile.name })} description={t("deleteConfirm", { name: profile.name })} size="sm">
      <form onSubmit={(e) => void submit(e)} noValidate className="text-start">
        {profile.hasPin && (
          <Field className="mt-2" label={t("deletePinLabel", { name: profile.name })} error={error.pin}>
            {(id, d, invalid) => <PinInput id={id} describedBy={d} invalid={invalid} value={pin} onChange={setPin} autoFocus />}
          </Field>
        )}
        {error.form && (
          <InlineAlert tone="danger" className="mt-4">
            {error.form}
          </InlineAlert>
        )}
        <DialogActions>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {tc("cancel")}
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            {t("deleteProfile")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
