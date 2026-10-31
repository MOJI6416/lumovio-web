"use client";

import type { Me, Profile } from "@lumovio/contracts";
import { Lock, LogOut, Settings2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { profileErrorText } from "@/components/profiles/profile-errors";
import { ProfileAvatar } from "@/components/ui/Avatar";
import { TvButton } from "@/components/ui/tv/TvButton";
import { TvTile } from "@/components/ui/tv/TvTile";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { TvLayer } from "../nav/TvLayer";
import { ContinueOnPhone } from "../shell/ContinueOnPhone";
import { NumPad } from "../shell/NumPad";
import { LeaveKids } from "./LeaveKids";

type Choice = Profile;

/**
 * "Who's watching?" on a TV (S24 TV, TV document §4 "Профили и вход", §7.1): big avatars in one row, the active profile
 * marked; a profile with a PIN asks for it on the on-screen keypad (or the remote's digits); leaving a kids profile for
 * an adult one without a PIN is confirmed on a phone — never with the account password typed by remote. Managing
 * profiles is done on a phone or a computer. A choice reloads the shell in that profile, at the address the TV was
 * opened with (`next`).
 */
export function ProfilesScreen({
  me,
  next,
  appVersion,
}: {
  me: Me;
  next: string;
  appVersion: string | null;
}) {
  const t = useTranslations("profiles");
  const tv = useTranslations("tvui");
  const tc = useTranslations("common");
  const locale = useLocale();
  const active = me.activeProfile;
  const [pin, setPin] = useState<{ profile: Choice; value: string; error: string | null } | null>(null);
  const [leaving, setLeaving] = useState<Choice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const go = () => {
    window.location.href = `${locale === "en" ? "" : `/${locale}`}${next}`;
  };

  /** Switches and opens the shell in the profile; the refusal, if any, for the caller to say. */
  const attempt = async (p: Choice, body: Record<string, string> = {}): Promise<unknown> => {
    try {
      await api("/api/profiles/select", { method: "POST", json: { profileId: p.id, ...body } });
      go();
      return null;
    } catch (e) {
      return e;
    }
  };

  const select = async (p: Choice, body: Record<string, string> = {}) => {
    setBusy(p.id);
    setError(null);
    const e = await attempt(p, body);
    if (!e) return;
    setBusy(null);
    if (pin) setPin({ ...pin, value: "", error: profileErrorText(t, e, "pin") });
    else setError(profileErrorText(t, e, "save"));
  };

  const choose = (p: Choice) => {
    if (p.id === active?.id) return go();
    if (p.hasPin) return setPin({ profile: p, value: "", error: null });
    // A kids session leaving for an adult profile without a PIN: confirmed elsewhere (TV document §7.1 item 5).
    if (active?.isKids && (!p.isKids || p.maturity !== active.maturity)) return setLeaving(p);
    void select(p);
  };

  return (
    <div
      data-tv-screen="home"
      data-tv-main
      className="stage flex h-full flex-col items-center justify-center gap-14 bg-stage px-(--gutter)"
    >
      <h1 className="text-h1 text-text-1">{t("whoIsWatching")}</h1>
      <div
        data-zone="profiles"
        // Many profiles wrap into rows (seen on the owner's TV): ↑↓ between the rows, ←→ along one.
        data-zone-axis="grid"
        className="flex max-w-full flex-wrap justify-center gap-10"
      >
        {me.profiles.map((p) => (
          <TvTile
            key={p.id}
            data-key={p.id}
            data-tv-initial={(active ? p.id === active.id : p === me.profiles[0]) || undefined}
            aria-current={p.id === active?.id || undefined}
            onClick={() => choose(p)}
            className="group/p w-44"
          >
            <span className="relative">
              <ProfileAvatar
                avatar={p.avatar}
                name={p.name}
                size="9rem"
                className="rounded-avatar ring-text-1 group-aria-[current=true]/p:ring-4"
              />
              {p.hasPin && (
                <span className="absolute -end-2 -bottom-2 grid size-10 place-items-center rounded-full bg-surface-2 text-text-1">
                  <Lock aria-label={t("locked")} className="size-5" />
                </span>
              )}
            </span>
            <span className="line-clamp-2 text-center text-title">{p.name}</span>
            {p.isKids && (
              <span className="rounded-xs bg-surface-2 px-2 py-0.5 text-body-s font-semibold text-text-1">
                {t("kidsTag")}
              </span>
            )}
            {busy === p.id && <span className="sr-only">{tc("loading")}</span>}
          </TvTile>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-body-l font-semibold text-danger">
          {error}
        </p>
      )}
      <div data-zone="profile-actions" data-zone-axis="x" className="flex gap-4">
        <TvButton icon={Settings2} onClick={() => setManaging(true)} aria-haspopup="dialog">
          {t("manage")}
        </TvButton>
        <TvButton
          icon={LogOut}
          onClick={() =>
            void authClient
              .signOut()
              .then(() => window.location.assign(`${locale === "en" ? "" : `/${locale}`}/tv`))
          }
        >
          {tc("signOut")}
        </TvButton>
      </div>
      {appVersion && (
        <p className="absolute bottom-6 text-body text-text-3">{tv("appVersion", { version: appVersion })}</p>
      )}

      {pin && (
        <TvLayer look="dialog" label={t("enterPin", { name: pin.profile.name })} onClose={() => setPin(null)}>
          {() => (
            <div className="flex flex-col items-center gap-6">
              <ProfileAvatar avatar={pin.profile.avatar} name={pin.profile.name} size="5rem" />
              <h2 className="text-h2 text-text-1">{t("enterPin", { name: pin.profile.name })}</h2>
              <NumPad
                label={t("pin")}
                value={pin.value}
                onChange={(value) => setPin({ ...pin, value, error: null })}
                onDone={() => void select(pin.profile, { pin: pin.value })}
                min={4}
                max={8}
                secret
                busy={busy === pin.profile.id}
              />
              <p role="alert" className="min-h-8 text-body-l font-semibold text-danger">
                {pin.error}
              </p>
            </div>
          )}
        </TvLayer>
      )}
      {managing && (
        <TvLayer look="dialog" label={t("manage")} className="max-w-240" onClose={() => setManaging(false)}>
          {() => <ContinueOnPhone path="/profiles?manage=1" title={t("manage")} text={tv("manageOnPhone")} />}
        </TvLayer>
      )}
      {leaving && active && (
        <LeaveKids
          from={active}
          to={leaving}
          onClose={() => setLeaving(null)}
          onDone={go}
          onCode={(code) => attempt(leaving, { code })}
        />
      )}
    </div>
  );
}
