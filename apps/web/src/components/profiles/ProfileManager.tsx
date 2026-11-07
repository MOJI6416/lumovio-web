"use client";

import type { PinHintState, Profile } from "@lumovio/contracts";
import { Lock, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useDiscardGuard } from "@/components/settings/use-unsaved";
import { AVATAR_COLORS, avatarColor, ProfileAvatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsLink, SettingsSection } from "@/components/ui/Settings";
import { Switch } from "@/components/ui/Switch";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { adultWithoutPin, showPinHint } from "./pin-hint";
import { profileErrorText } from "./profile-errors";

/**
 * Manage profiles (design-system 7.17): the account's profiles as rows — as the account menu lists them (the face, the
 * name, "Kids", a lock where a PIN is asked) — each leading to its page, and "Add profile" last (off at the limit, with
 * the limit said). While the account has a kids profile and an adult one without a PIN, "Set a PIN on adult profiles"
 * stands over the rows (8.10): "Set PIN" opens the first such profile's page at its PIN, "Not now" holds it 30 days.
 */
export function ManageView({
  profiles,
  currentId,
  limit,
  pinHint,
  backHref,
  editHref,
  onAdd,
  onSetPin,
}: {
  profiles: Profile[];
  currentId: string | undefined;
  limit: number;
  pinHint: PinHintState | null;
  backHref: string;
  editHref: (id: string) => string;
  onAdd: () => void;
  onSetPin: (p: Profile) => void;
}) {
  const t = useTranslations("profiles");
  const tc = useTranslations("common");
  const [hint, setHint] = useState(pinHint);
  const noPin = adultWithoutPin(profiles);
  // Manage profiles is an adult's (a kids session never gets here).
  const hintShown = showPinHint({ profiles, active: { isKids: false }, hint });
  const full = profiles.length >= limit;
  // "Not now": off for 30 days on the whole account, kept on the server; "Undo" in the toast brings it back.
  const snooze = useAction({
    run: async () => {
      const s = await api<PinHintState>("/api/profiles/pin-hint/snooze", { method: "POST", json: {} });
      setHint(s);
      return s;
    },
    optimistic: () => {
      const was = hint;
      setHint({ snoozedUntil: new Date(Date.now() + 30 * 86_400_000).toISOString() });
      return () => setHint(was);
    },
    success: t("pinHintSnoozed"),
    undo: () => api<PinHintState>("/api/profiles/pin-hint/snooze", { method: "DELETE" }),
  });

  return (
    <div className="mx-auto w-full max-w-xl text-start">
      <PageHeader className="pt-0 sm:pt-0" title={t("manage")} back={{ href: backHref, label: tc("back") }} />
      {hintShown && noPin && (
        // Calm, not a dialog (8.10): what to do and why, here where an adult manages the profiles.
        <InlineAlert
          className="mb-6"
          title={t("pinHintTitle")}
          action={
            <div className="flex flex-wrap gap-x-1">
              <Button variant="tertiary" size="sm" onClick={() => onSetPin(noPin)}>
                {t("setPin")}
              </Button>
              <Button variant="tertiary" size="sm" loading={snooze.pending} onClick={() => void snooze.run()}>
                {t("notNow")}
              </Button>
            </div>
          }
        >
          {t("pinHintText")}
        </InlineAlert>
      )}
      <SettingsSection>
        {profiles.map((p) => (
          <SettingsLink
            key={p.id}
            href={editHref(p.id)}
            leading={<ProfileAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={40} />}
            label={
              <span className="block truncate">
                {p.name}
                {p.id === currentId && <span className="sr-only"> · {t("current")}</span>}
              </span>
            }
            value={
              (p.isKids || p.hasPin) && (
                <>
                  {p.isKids && <Tag>{t("kidsTag")}</Tag>}
                  {p.hasPin && (
                    <>
                      <Lock aria-hidden className="size-4 shrink-0 text-text-3" />
                      <span className="sr-only">{t("locked")}</span>
                    </>
                  )}
                </>
              )
            }
          />
        ))}
        <SettingsLink
          // The tile of "Who's watching?" as a row: a ring of --line-2 with Plus where a face would be.
          leading={
            <span className="grid size-10 place-items-center rounded-avatar border-2 border-line-2 text-text-2">
              <Plus aria-hidden className="size-5" />
            </span>
          }
          label={t("add")}
          detail={full ? t("limitShort", { count: limit }) : undefined}
          disabled={full}
          opens
          onClick={onAdd}
        />
      </SettingsSection>
    </div>
  );
}

/**
 * "Add profile" (7.17): only what makes a profile — its name and whether it is a kids one — with the face it will have
 * (a colour no other profile has, the name's letter). "Create profile" opens the new profile's page, where its photo,
 * age level and PIN are, as Max and Disney+ ask the rest after the name.
 */
export function CreateProfile({
  profiles,
  onClose,
  onCreated,
}: {
  profiles: Profile[];
  onClose: () => void;
  /** The new profile, the list with it, and whether to offer PINs to the adult profiles (a new kids one, 8.10). */
  onCreated: (p: Profile, list: Profile[], askPin: boolean) => void;
}) {
  const t = useTranslations("profiles");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [isKids, setIsKids] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [color] = useState(() => {
    const taken = profiles.map((p) => avatarColor(p.avatar));
    return AVATAR_COLORS.find((c) => !taken.includes(c)) ?? AVATAR_COLORS[profiles.length % AVATAR_COLORS.length]!;
  });
  const close = useDiscardGuard(name.trim() !== "" || isKids, onClose);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Checked on submit, said at the field (one model for every form, AUTH-04).
    if (!name.trim()) return setErrors({ name: t("nameMissing") });
    setBusy(true);
    setErrors({});
    try {
      const p = await api<Profile>("/api/profiles", {
        method: "POST",
        json: { name: name.trim(), avatar: color, isKids, maturity: isKids ? "kids" : "adult", showAnime: true },
      });
      const list = [...profiles, p];
      onCreated(p, list, p.isKids && adultWithoutPin(list) !== null);
    } catch (err) {
      setBusy(false);
      setErrors({ form: profileErrorText(t, err, "save") });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && void close()} title={t("add")} size="sm">
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-6 text-start">
        <div className="flex justify-center">
          <ProfileAvatar avatar={color} name={name} size={88} />
        </div>
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
                setErrors((x) => ({ ...x, name: undefined }));
              }}
            />
          )}
        </Field>
        {/* A kids profile's limits stay said (1.2, principle 6): what it shows and what leaving it takes. */}
        <Switch checked={isKids} onCheckedChange={setIsKids} label={t("kids")} description={t("kidsHint")} />
        {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
        <DialogActions className="mt-0">
          <Button variant="secondary" disabled={busy} onClick={() => void close()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("create")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/**
 * A kids profile was just created and an adult profile has no PIN (8.10): «Set a PIN on adult profiles?» with "Later"
 * and "Set PIN" (the first such profile's page, at its PIN), shown whatever "Not now" says.
 */
export function PinOffer({
  name,
  profiles,
  onClose,
  onSetPin,
}: {
  name: string;
  profiles: Profile[];
  onClose: () => void;
  onSetPin: (p: Profile) => void;
}) {
  const t = useTranslations("profiles");
  const noPin = adultWithoutPin(profiles);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t("pinOfferTitle")} size="sm">
      <p className="text-start text-body text-text-2">{t("pinOfferText", { name })}</p>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          {t("later")}
        </Button>
        <Button onClick={() => (noPin ? onSetPin(noPin) : onClose())}>{t("setPin")}</Button>
      </DialogActions>
    </Dialog>
  );
}
