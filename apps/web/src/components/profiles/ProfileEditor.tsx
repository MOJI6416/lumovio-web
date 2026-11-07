"use client";

import type { AvatarColor, MaturityLevel, Profile } from "@lumovio/contracts";
import { clsx } from "clsx";
import { Check, ChevronLeft, CircleAlert, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { AUTO, useLocaleOptions } from "@/components/settings/locale-options";
import { useDiscardGuard } from "@/components/settings/use-unsaved";
import { AVATAR_COLORS, avatarColor, ProfileAvatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SaveError, SaveStatus, SettingsLink, SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { peerFocusRing } from "@/components/ui/styles";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";
import { UpLink } from "@/components/ui/UpLink";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAction, useSettingsSave } from "@/lib/use-action";
import { loadPicture, type Picture, PhotoCrop } from "./PhotoCrop";
import { isPinError, profileErrorText } from "./profile-errors";

const PIN = /^\d{4,8}$/;

/** Sends a profile's new photo (the cropped square); the profile as it is after it. */
function putPhoto(id: string, image: Blob): Promise<Profile> {
  return api<Profile>(`/api/profiles/${id}/photo`, { method: "PUT", body: image, headers: { "content-type": image.type || "image/png" } });
}

/**
 * One colour as a native radio (arrows move and choose, Tab leaves the group, as ui/RadioGroup): the avatar it gives,
 * the selection ring and its check.
 */
function ColorOption(props: { group: string; value: string; checked: boolean; onChange: () => void; label: string; name: string }) {
  return (
    <label className="relative block cursor-pointer">
      <input type="radio" name={props.group} value={props.value} checked={props.checked} onChange={props.onChange} aria-label={props.label} className="peer sr-only" />
      <span className={clsx("block rounded-avatar p-0.5 transition", peerFocusRing, props.checked ? "ring-3 ring-selected-bg" : "opacity-80 hover:opacity-100")}>
        <ProfileAvatar avatar={props.value} name={props.name} size={36} className="!h-auto !w-full aspect-square" />
      </span>
      {props.checked && (
        <span aria-hidden className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-selected-bg text-selected-fg">
          <Check className="size-3.5" />
        </span>
      )}
    </label>
  );
}

/** A digit field for a PIN: hidden figures, the phone's number pad. */
function PinInput(props: { id: string; describedBy?: string; invalid: boolean; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <Input
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
      className="tracking-widest"
    />
  );
}

/**
 * A profile's page in Manage profiles (design-system 7.17, 7.18; audit PRF-07…PRF-09, PRF-13): its face and name on
 * top, then rows as the settings have them. The face changes there: "Choose photo" → "Move and scale" → "Done" keeps
 * it, "Remove photo" takes it off (Undo in the toast), a colour applies at once — nothing waits for a "Save" (8.8).
 * Rows: Name › and PIN › (each a dialog-form), the catalog (age level, anime), language and region — an adult sets
 * them for any profile, a kids one included — and "Delete profile" last, red, with what goes with it.
 */
export function EditView({
  profile: p,
  profiles,
  current,
  backHref,
  focusPin,
  onPinShown,
  onChange,
  onDeleted,
}: {
  profile: Profile;
  profiles: Profile[];
  /** The session's own profile: a new interface language switches the page to it, as in the settings. */
  current: boolean;
  backHref: string;
  /** Opened by "Set PIN" (8.10): its PIN dialog opens at once. */
  focusPin: boolean;
  onPinShown: () => void;
  onChange: (p: Profile) => void;
  onDeleted: (p: Profile) => void;
}) {
  const t = useTranslations("profiles");
  const ts = useTranslations("settings");
  const ids = useId();
  const locale = useLocale();
  const router = useRouter();
  const options = useLocaleOptions();
  const [dialog, setDialog] = useState<"name" | "pin" | "delete" | null>(focusPin ? "pin" : null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, as the page opens
  useEffect(() => {
    if (focusPin) onPinShown();
  }, []);
  const face = useSettingsSave();
  const catalog = useSettingsSave();
  const langs = useSettingsSave();
  const kids = p.isKids;
  const color = avatarColor(p.avatar);
  const others = profiles.filter((x) => x.id !== p.id).map((x) => avatarColor(x.avatar));
  const maturities: MaturityLevel[] = ["kids", "family", "teen", ...(kids ? [] : (["adult"] as const))];

  // The photo: the chosen file being framed, while it opens, and the framed square shown while it uploads.
  const [cropping, setCropping] = useState<Picture | null>(null);
  const [opening, setOpening] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoButton = useRef<HTMLButtonElement>(null);
  const uploading = face.state.status === "saving" && preview !== null;

  /** A change applied at once (8.8): shown before the answer, put back if it fails, "Saved" by the group. */
  const patch = (save: typeof face.save, body: Partial<Profile>) =>
    save(
      () => api<Profile>(`/api/profiles/${p.id}`, { method: "PATCH", json: body }).then(onChange),
      () => {
        const was = p;
        onChange({ ...p, ...body });
        return () => onChange(was);
      },
    );

  // "Done" in "Move and scale" keeps the photo at once: the framed square shows while it uploads; a failure says so
  // under the face with "Retry", and the face is as it was.
  const keepPhoto = (image: Blob) =>
    void face.save(async () => {
      const url = URL.createObjectURL(image);
      setPreview(url);
      try {
        onChange(await putPhoto(p.id, image));
      } finally {
        setPreview(null);
        URL.revokeObjectURL(url);
      }
    });

  // "Remove photo": at once, and Undo puts the same picture back (it is read before it goes: the server forgets it).
  const removePhoto = useAction({
    run: async () => {
      const image = p.photo ? await fetch(p.photo).then((r) => (r.ok ? r.blob() : null), () => null) : null;
      onChange(await api<Profile>(`/api/profiles/${p.id}/photo`, { method: "DELETE" }));
      photoButton.current?.focus();
      return image;
    },
    success: t("photoRemoved"),
    undo: async (image) => {
      if (!image) throw new Error("no photo");
      onChange(await putPhoto(p.id, image));
    },
  });
  const shownPhoto = preview ?? p.photo;

  return (
    <div className="mx-auto w-full max-w-xl text-start">
      {/* "‹ Manage profiles" as a page's head has it (PageHeader, 8.7), over the face rather than beside a title. */}
      <UpLink
        href={backHref}
        className="-ms-1 inline-flex min-h-11 w-fit items-center gap-1 pe-2 text-body-s font-semibold text-text-2 transition-colors duration-fast ease-fast hover:text-text-1 sm:min-h-8"
      >
        <ChevronLeft aria-hidden className="size-4 shrink-0" />
        {t("manage")}
      </UpLink>

      {/* The face and the name: what the profile looks like everywhere — the header, the menu, "Who's watching?". */}
      <div className="flex flex-col items-center text-center">
        <span className="relative">
          <ProfileAvatar avatar={color} photo={shownPhoto} name={p.name} size={120} />
          {uploading && (
            <span className="absolute inset-0 grid place-items-center rounded-avatar bg-scrim text-white">
              <Loader2 aria-hidden className="size-8 animate-spin" />
            </span>
          )}
        </span>
        <h1 className="mt-4 max-w-full break-words text-h1 text-text-1">{p.name}</h1>
        {kids && <Tag className="mt-2">{t("kidsTag")}</Tag>}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button ref={photoButton} variant="secondary" size="sm" loading={opening} disabled={uploading} onClick={() => photoInput.current?.click()}>
            {shownPhoto ? t("photoChange") : t("photoAdd")}
          </Button>
          {p.photo && !preview && (
            <Button variant="tertiary" size="sm" loading={removePhoto.pending} onClick={() => void removePhoto.run()}>
              {t("photoRemove")}
            </Button>
          )}
        </div>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden
          aria-label={t("photoAdd")}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // The same file can be chosen again after Cancel.
            e.target.value = "";
            if (!file) return;
            setOpening(true);
            setPhotoError(null);
            loadPicture(file)
              .then(setCropping, () => setPhotoError(t("photoUnreadable")))
              .finally(() => setOpening(false));
          }}
        />
        {photoError && (
          <p role="alert" className="mt-3 flex items-start gap-1 text-caption font-medium text-danger">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {photoError}
          </p>
        )}
        {!shownPhoto && (
          // Without a photo, the colour of the letter: a radio group, a colour another profile has says so (X-21).
          <fieldset className="mt-6 w-full">
            <legend className="sr-only">{t("avatarColor")}</legend>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {AVATAR_COLORS.map((c, i) => (
                <ColorOption
                  key={c}
                  group={`${ids}-color`}
                  value={c}
                  checked={color === c}
                  onChange={() => void patch(face.save, { avatar: c as AvatarColor })}
                  label={others.includes(c) ? t("avatarOptionTaken", { n: i + 1 }) : t("avatarOption", { n: i + 1 })}
                  name={p.name}
                />
              ))}
            </div>
          </fieldset>
        )}
        <SaveStatus save={face.state} className="mt-3 min-h-5" />
        <SaveError save={face.state} className="mt-3 w-full text-start" />
      </div>

      <div className="mt-8 flex flex-col gap-8">
        <SettingsSection>
          <SettingsLink label={t("name")} value={<span className="truncate">{p.name}</span>} opens onClick={() => setDialog("name")} />
          <SettingsLink label={t("pinSection")} value={p.hasPin ? t("pinOn") : t("pinOff")} description={t("pinHint")} opens onClick={() => setDialog("pin")} />
        </SettingsSection>

        <SettingsSection title={ts("sectionCatalog")} save={catalog.state}>
          <SettingsRow inline label={t("maturity")} description={kids ? t("maturityKidsHint") : undefined} htmlFor={`${ids}-maturity`}>
            <Select<MaturityLevel>
              id={`${ids}-maturity`}
              size="sm"
              className="sm:w-56"
              value={kids && p.maturity === "adult" ? "kids" : p.maturity}
              onValueChange={(maturity) => void patch(catalog.save, { maturity })}
              options={maturities.map((m) => ({ value: m, label: t(`maturity_${m}`) }))}
            />
          </SettingsRow>
          {/* An adult sets it for any profile; a kids one doesn't change it itself (8.14). */}
          <SettingsRow label={t("anime")} description={t("animeHint")} htmlFor={`${ids}-anime`}>
            <Switch id={`${ids}-anime`} hideLabel label={t("anime")} checked={p.showAnime} onCheckedChange={(showAnime) => void patch(catalog.save, { showAnime })} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title={ts("sectionLanguage")} save={langs.state}>
          <SettingsRow label={ts("interfaceLanguage")} description={t("uiLanguageProfileHint")} htmlFor={`${ids}-ui`}>
            <Select
              id={`${ids}-ui`}
              size="sm"
              className="sm:w-56"
              value={p.uiLocale ?? AUTO}
              onValueChange={async (v) => {
                const next = v === AUTO ? null : v;
                // The session's own profile: the site follows its language as soon as it is saved (L10N-06).
                if ((await patch(langs.save, { uiLocale: next })) && current && next && next !== locale)
                  router.replace(`/profiles${window.location.search}`, { locale: next as never });
              }}
              options={options.ui(p.uiLocale)}
            />
          </SettingsRow>
          <SettingsRow label={t("metadataLanguage")} description={t("metadataLanguageHint")} htmlFor={`${ids}-meta`}>
            <Combobox
              id={`${ids}-meta`}
              size="sm"
              className="sm:w-56"
              value={p.metadataLocale ?? AUTO}
              onValueChange={(v) => void patch(langs.save, { metadataLocale: v === AUTO ? null : v })}
              options={options.metadata}
            />
          </SettingsRow>
          {/* An adult sets the region of any profile: a kids profile can't change it itself (PRF-13). */}
          <SettingsRow label={t("region")} description={kids ? t("regionKidsHint") : t("regionHint")} htmlFor={`${ids}-region`}>
            <Combobox
              id={`${ids}-region`}
              size="sm"
              className="sm:w-56"
              value={p.region ?? AUTO}
              onValueChange={(v) => void patch(langs.save, { region: v === AUTO ? null : v })}
              options={options.region}
            />
          </SettingsRow>
        </SettingsSection>

        {profiles.length > 1 && (
          // The risky one last, red, with what goes with it (7.18); it always asks.
          <SettingsSection>
            <SettingsLink tone="danger" label={t("deleteProfile")} detail={t("deleteConfirm")} onClick={() => setDialog("delete")} />
          </SettingsSection>
        )}
      </div>

      {dialog === "name" && (
        <NameDialog
          profile={p}
          onClose={() => setDialog(null)}
          onSaved={(q) => {
            onChange(q);
            setDialog(null);
          }}
        />
      )}
      {dialog === "pin" && (
        <PinDialog
          profile={p}
          onClose={() => setDialog(null)}
          onDone={(q, how) => {
            onChange(q);
            setDialog(null);
            toast.success(t(how, { name: q.name }));
          }}
        />
      )}
      {dialog === "delete" && <DeleteProfile profile={p} onCancel={() => setDialog(null)} onDeleted={() => onDeleted(p)} />}
      {cropping && (
        <PhotoCrop
          picture={cropping}
          color={color}
          onCancel={() => {
            URL.revokeObjectURL(cropping.url);
            setCropping(null);
          }}
          onDone={(image) => {
            URL.revokeObjectURL(cropping.url);
            setCropping(null);
            if (image) keepPhoto(image);
            else setPhotoError(t("photoUnreadable"));
          }}
        />
      )}
    </div>
  );
}

/** "Name" (8.8: a text field is a dialog-form): the field, "Save" — off until the name changes — and "Cancel". */
function NameDialog({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const t = useTranslations("profiles");
  const tc = useTranslations("common");
  const [name, setName] = useState(profile.name);
  const [errors, setErrors] = useState<{ name?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== profile.name;
  const close = useDiscardGuard(dirty, onClose);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErrors({ name: t("nameMissing") });
    setBusy(true);
    try {
      const q = await api<Profile>(`/api/profiles/${profile.id}`, { method: "PATCH", json: { name: name.trim() } });
      onSaved(q);
    } catch (err) {
      setBusy(false);
      setErrors({ form: profileErrorText(t, err, "save") });
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && void close()} title={t("name")} size="sm">
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4 text-start">
        <Field label={t("name")} error={errors.name}>
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              autoFocus
              autoComplete="off"
              maxLength={40}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors({});
              }}
            />
          )}
        </Field>
        {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
        <DialogActions className="mt-2">
          <Button variant="secondary" disabled={busy} onClick={() => void close()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={busy} disabled={!dirty}>
            {tc("save")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/**
 * "PIN" (8.8, 8.10): without one — the new PIN and "Set PIN"; with one — the current PIN, a new one and "Change PIN",
 * or the red row "Remove PIN" with the current PIN alone. A wrong current PIN is said at its field and the dialog stays.
 */
function PinDialog({
  profile,
  onClose,
  onDone,
}: {
  profile: Profile;
  onClose: () => void;
  onDone: (p: Profile, how: "pinSetDone" | "pinChangedDone" | "pinRemovedDone") => void;
}) {
  const t = useTranslations("profiles");
  const tc = useTranslations("common");
  const has = profile.hasPin;
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [errors, setErrors] = useState<{ current?: string; pin?: string; form?: string }>({});
  const [busy, setBusy] = useState<"set" | "remove" | null>(null);
  const close = useDiscardGuard(current !== "" || pin !== "", onClose);
  const submit = async (remove: boolean) => {
    const found = {
      current: has && !current ? t("enterCurrentPin") : undefined,
      pin: !remove && !PIN.test(pin) ? t("pinFormat") : undefined,
    };
    setErrors(found);
    if (found.current || found.pin) return;
    setBusy(remove ? "remove" : "set");
    try {
      await api(`/api/profiles/${profile.id}/pin`, { method: "PUT", json: has ? { pin: remove ? null : pin, currentPin: current } : { pin } });
      onDone({ ...profile, hasPin: !remove }, remove ? "pinRemovedDone" : has ? "pinChangedDone" : "pinSetDone");
    } catch (err) {
      setBusy(null);
      if (isPinError(err)) setErrors(has ? { current: profileErrorText(t, err, "pin") } : { pin: profileErrorText(t, err, "pin") });
      else setErrors({ form: profileErrorText(t, err, "save") });
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && void close()} title={t("pinSection")} size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
        noValidate
        className="flex flex-col gap-4 text-start"
      >
        {has && (
          <Field label={t("currentPin")} error={errors.current}>
            {(id, d, invalid) => (
              <PinInput
                id={id}
                describedBy={d}
                invalid={invalid}
                value={current}
                autoFocus
                onChange={(v) => {
                  setCurrent(v);
                  setErrors((x) => ({ ...x, current: undefined }));
                }}
              />
            )}
          </Field>
        )}
        <Field label={t("newPin")} hint={t("pinDigits")} error={errors.pin}>
          {(id, d, invalid) => (
            <PinInput
              id={id}
              describedBy={d}
              invalid={invalid}
              value={pin}
              autoFocus={!has}
              onChange={(v) => {
                setPin(v);
                setErrors((x) => ({ ...x, pin: undefined }));
              }}
            />
          )}
        </Field>
        {has && (
          // At most two buttons at the bottom of a dialog (7.18): taking the PIN off is the risky row, red, with what it
          // does; it needs the current PIN above, as changing it does.
          <SettingsSection raised>
            <SettingsLink tone="danger" label={t("removePin")} detail={t("pinRemoveDetail")} disabled={busy !== null} onClick={() => void submit(true)} />
          </SettingsSection>
        )}
        {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
        <DialogActions className="mt-2">
          <Button variant="secondary" disabled={busy !== null} onClick={() => void close()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={busy === "set"} disabled={busy === "remove"}>
            {has ? t("changePin") : t("setPin")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
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
