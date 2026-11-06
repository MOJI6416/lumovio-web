"use client";

import type { LeaveCodeSent, Me, PinHintState, Profile } from "@lumovio/contracts";
import { clsx } from "clsx";
import { ChevronLeft, Lock, LogOut, Pencil, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input, PasswordInput } from "@/components/ui/Input";
import { LayerStageContext } from "@/components/ui/portal";
import { toast } from "@/components/ui/Toast";
import { LOCALE_CODES } from "@/i18n/locales";
import { ApiRequestError, api } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";
import { useAction } from "@/lib/use-action";
import { adultWithoutPin, showPinHint } from "./pin-hint";
import { codeSendErrorText, profileErrorText } from "./profile-errors";

// The editor (fields, lists, the delete confirmation) loads when it is opened: the picker stays light.
const ProfileEditor = dynamic(() => import("./ProfileEditor").then((m) => m.ProfileEditor), { ssr: false });

/** The picker's avatar (7.17). */
const AVATAR_SIZE = 120;

/** How many profiles an account can have (the API's limit, PRF-08). */
export const MAX_PROFILES = 8;

/**
 * What switching to a protected profile asks for: its PIN, or — leaving a kids profile for an adult one without a PIN —
 * the account password or a code mailed to the account. An account without a password (social sign-in only) gets the
 * code straight away; one with it starts at the password and can take the code instead (PRF-01, docs/limitations.md).
 */
type Prompt = { profile: Profile; mode: "pin" | "password" | "code" } | null;

/** A code mailed for this prompt: when "Send again" works, and whether it replaced an earlier one. */
type CodeSent = { until: number; again: boolean } | null;

/** Seconds left until `until` (a timestamp), ticking each second; 0 without one. */
function useSecondsLeft(until: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (until === null) {
      setLeft(0);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);
  return left;
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * "Who's watching?" and Manage profiles (the Picker template, design-system 7.17, 9; audit PRF-07…PRF-10): the stage,
 * a grid of 120 avatars with the current profile ringed, "Add profile" as a tile (off with the reason at the limit),
 * "Manage profiles" (secondary) that turns the tiles into editors, "← Back" and "Done" to leave it, and "Not you? Sign
 * out" for the account itself. Choosing a profile goes on to `next` in the profile's own interface language (L10N-06).
 * With a kids profile in the account, adult profiles without a PIN are pointed out (8.10): the hint "Set a PIN on adult
 * profiles" (`pinHint` holds its "Not now"), "No PIN" on their tiles in Manage profiles, and the same offer right after
 * a kids profile is created.
 */
export function ProfilePicker({ me, pinHint }: { me: Me; pinHint: PinHintState | null }) {
  const t = useTranslations("profiles");
  const tc = useTranslations("common");
  // The code field and "Send again" say what the sign-in's code steps say (AUTH-09).
  const ta = useTranslations("auth");
  const locale = useLocale();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/");
  // Opened as "Manage profiles" from somewhere else (the settings): "Done" goes back there.
  // A kids profile doesn't manage profiles (8.10): the address alone doesn't open the editing mode.
  const inKids = me.activeProfile?.isKids ?? false;
  const manageOnly = params.get("manage") === "1" && !inKids;
  const [profiles, setProfiles] = useState(me.profiles);
  const [manage, setManage] = useState(manageOnly);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Profile | "new" | null>(null);
  // The editor opened by "Set PIN": straight at the PIN field.
  const [pinFirst, setPinFirst] = useState(false);
  const [hint, setHint] = useState(pinHint);
  // A kids profile was just created and an adult profile has no PIN: "Set a PIN on adult profiles?" (`name`: the new one).
  const [offer, setOffer] = useState({ open: false, name: "" });
  const [codeSent, setCodeSent] = useState<CodeSent>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const resendIn = useSecondsLeft(codeSent?.until ?? null);
  const currentId = me.activeProfile?.id;
  // Social sign-in only: there is no account password to type.
  const hasPassword = me.linkedProviders.includes("credential");
  const limit = me.maxProfiles ?? MAX_PROFILES;
  const full = profiles.length >= limit;
  const hasKids = profiles.some((p) => p.isKids);
  const noPin = adultWithoutPin(profiles);
  const hintShown = showPinHint({ profiles, active: me.activeProfile, hint });

  const edit = (p: Profile | "new", pin = false) => {
    setPinFirst(pin);
    setEditing(p);
  };
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

  const to = (path: string, lang = locale) => lang === "en" ? path : `/${lang}${path === "/" ? "" : path}`;
  // The profile's own interface language, when it has one, is the site's language from here on (L10N-06).
  const go = (p: Profile) => {
    const lang = p.uiLocale && (LOCALE_CODES as readonly string[]).includes(p.uiLocale) ? p.uiLocale : locale;
    window.location.href = to(next, lang);
  };
  const leaveManage = () => {
    if (manageOnly) window.location.href = to(next);
    else setManage(false);
  };

  async function select(p: Profile, extra: { pin?: string; password?: string; code?: string } = {}) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/profiles/select", { method: "POST", json: { profileId: p.id, ...extra } });
      go(p);
    } catch (e) {
      const asked = e instanceof ApiRequestError && (e.code === "pin_required" || e.code === "password_required");
      const mode = e instanceof ApiRequestError && e.code === "pin_required" ? "pin" : hasPassword ? "password" : "code";
      if (prompt) setError(profileErrorText(t, e, prompt.mode));
      else if (asked) setPrompt({ profile: p, mode });
      else toast.error(profileErrorText(t, e, "pin"));
      setBusy(false);
    }
  }

  /** Mails a code to the account (never shown here); "Send again" waits as long as the server says. */
  async function sendCode(p: Profile) {
    setSending(true);
    setSendError(null);
    try {
      const res = await api<LeaveCodeSent>("/api/profiles/select/code", { method: "POST", json: { profileId: p.id } });
      setCodeSent((was) => ({ until: Date.now() + res.resendAfter * 1000, again: res.sent ? was !== null : (was?.again ?? false) }));
      if (res.sent) {
        setSecret("");
        setError(null);
      }
    } catch (e) {
      setSendError(codeSendErrorText(t, e));
    } finally {
      setSending(false);
    }
  }

  // The password or the code: the code is mailed when first asked for here, not again on each switch.
  const switchProof = (mode: "password" | "code") => {
    if (!prompt) return;
    setPrompt({ ...prompt, mode });
    setSecret("");
    setError(null);
    setSendError(null);
    if (mode === "code" && !codeSent) void sendCode(prompt.profile);
  };

  const closePrompt = () => {
    setPrompt(null);
    setError(null);
    setSecret("");
    setCodeSent(null);
    setSendError(null);
  };

  // Deep link from the account menu: /profiles?switch=<id>
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on arrival
  useEffect(() => {
    const id = params.get("switch");
    const p = id ? profiles.find((x) => x.id === id) : null;
    if (p) void select(p);
  }, []);

  const signOut = async () => {
    setBusy(true);
    try {
      const { authClient } = await import("@/lib/auth-client");
      await authClient.signOut();
      window.location.href = to("/auth/sign-in");
    } catch (e) {
      setBusy(false);
      toast.error(profileErrorText(t, e, "save"));
    }
  };

  const submitPrompt = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    if (prompt.mode === "pin" && !/^\d{4,8}$/.test(secret)) return setError(t("pinFormat"));
    if (prompt.mode === "password" && !secret) return setError(t("passwordMissing"));
    if (prompt.mode === "code" && !/^\d{6}$/.test(secret)) return setError(secret ? ta("codeSixDigits") : ta("codeMissing"));
    void select(prompt.profile, prompt.mode === "pin" ? { pin: secret } : prompt.mode === "code" ? { code: secret } : { password: secret });
    setSecret("");
  };

  const title = manage ? t("manage") : t("whoIsWatching");
  return (
    <div className="text-center">
      {manage && (
        // "← Back": out of the editing mode, to where it was opened from (8.7).
        <div className="mb-4 flex justify-start">
          <Button variant="tertiary" size="sm" icon={ChevronLeft} onClick={leaveManage} className="-ms-3">
            {tc("back")}
          </Button>
        </div>
      )}
      <h1 className="text-balance text-h1 text-text-1">{title}</h1>
      {manage && <p className="mx-auto mt-3 max-w-measure text-body text-text-2">{t("manageIntro")}</p>}
      {inKids && <p className="mx-auto mt-3 max-w-measure text-body text-text-2">{hasPassword ? t("leaveKidsHint") : t("leaveKidsHintNoPassword")}</p>}
      {hintShown && noPin && (
        // Calm, not a dialog (8.10): what to do and why, without saying how a child would get here.
        <InlineAlert
          className="mx-auto mt-6 max-w-2xl text-start"
          title={t("pinHintTitle")}
          action={
            <div className="flex flex-wrap gap-x-1">
              <Button variant="tertiary" size="sm" onClick={() => edit(noPin, true)}>
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
      <ul className="mt-10 grid grid-cols-2 justify-center justify-items-center gap-x-4 gap-y-8 sm:flex sm:flex-wrap sm:gap-10">
        {profiles.map((p) => {
          const current = p.id === currentId;
          // Managing, with a kids profile in the account: an adult profile without a PIN says so (8.10).
          const openToKids = manage && hasKids && !p.isKids && !p.hasPin;
          return (
            <li key={p.id}>
              <button /* ui-lint-ignore raw-button: a profile tile (avatar + name), 7.17 */
                type="button"
                // Not `disabled` while a choice is in flight: a disabled button drops the focus, and the PIN or
                // password dialog that follows would have nowhere to give it back on Escape (C27).
                aria-disabled={busy || undefined}
                aria-current={current && !manage ? "true" : undefined}
                aria-label={manage ? t("editNamed", { name: p.name }) : undefined}
                aria-describedby={openToKids ? `no-pin-${p.id}` : undefined}
                onClick={() => {
                  if (busy) return;
                  if (manage) edit(p);
                  else void select(p);
                }}
                className="group/pp flex w-36 flex-col items-center gap-3 rounded-md p-2 outline-offset-4"
              >
                <span
                  className={clsx(
                    "relative rounded-avatar transition duration-200 group-hover/pp:scale-105 group-focus-visible/pp:scale-105 motion-reduce:transform-none",
                    // The current profile: a white ring around the squircle (a shape, not only a colour).
                    current && !manage && "outline-2 outline-offset-4 outline-text-1 outline-solid",
                  )}
                >
                  <ProfileAvatar avatar={p.avatar} name={p.name} size={AVATAR_SIZE} />
                  {manage && (
                    // The avatar squircle (6.1), dimmed with the stage veil.
                    <span className="stage absolute inset-0 grid place-items-center rounded-avatar bg-stage/50">
                      <Pencil aria-hidden className="size-8 text-text-1" />
                    </span>
                  )}
                  {p.hasPin && !manage && (
                    <span className="absolute -bottom-1 -end-1 grid size-8 place-items-center rounded-full border-2 border-bg bg-surface-3 text-text-1">
                      <Lock aria-hidden className="size-4" />
                      <span className="sr-only">{t("locked")}</span>
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate text-title text-text-2 group-hover/pp:text-text-1">
                  {p.name}
                  {current && !manage && <span className="sr-only"> · {t("current")}</span>}
                </span>
                {p.isKids && <Tag className="-mt-2">{t("kidsTag")}</Tag>}
                {openToKids && (
                  <span id={`no-pin-${p.id}`} className="-mt-2">
                    <Tag>{t("noPinTag")}</Tag>
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {!inKids && (
          <li>
            {/* At the limit the tile stays, off, with the reason under it (PRF-08). */}
            <button /* ui-lint-ignore raw-button: the "Add profile" tile, 7.17 */
              type="button"
              disabled={full || busy}
              aria-describedby={full ? "profiles-limit" : undefined}
              onClick={() => edit("new")}
              className="group/pp flex w-36 flex-col items-center gap-3 rounded-md p-2 outline-offset-4 disabled:cursor-not-allowed"
            >
              <span
                // The avatar's own size (ui/Avatar draws it in px), so the tile matches it on a TV's scale too.
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                className={clsx(
                  "grid place-items-center rounded-avatar border-2 border-line-2 text-text-2 transition-colors duration-fast ease-fast",
                  full ? "opacity-40" : "group-hover/pp:border-text-3 group-hover/pp:text-text-1",
                )}
              >
                <Plus aria-hidden className="size-10" />
              </span>
              <span className={clsx("text-title", full ? "text-text-3" : "text-text-2 group-hover/pp:text-text-1")}>{t("add")}</span>
              {full && (
                <span id="profiles-limit" className="-mt-2 text-body-s text-text-2">
                  {t("limitShort", { count: limit })}
                </span>
              )}
            </button>
          </li>
        )}
      </ul>

      <div className="mt-12 flex flex-col items-center gap-4">
        {manage ? (
          <Button onClick={leaveManage}>{tc("done")}</Button>
        ) : (
          !inKids && (
            <Button variant="secondary" onClick={() => setManage(true)}>
              {t("manage")}
            </Button>
          )
        )}
        {!manage && (
          // Not on a TV: signing out there is in the account menu, and the TV keeps its own shell (10.3).
          <p className="flex flex-wrap items-center justify-center gap-x-2 text-body-s text-text-2 in-data-[tv=1]:hidden">
            {t("notYou")}
            <Button variant="tertiary" size="sm" icon={LogOut} loading={busy && !prompt} onClick={() => void signOut()}>
              {tc("signOut")}
            </Button>
          </p>
        )}
      </div>

      {/* The PIN, password or code dialog (opened by /profiles?switch= as the page loads), the editor and the offer after
          a new kids profile open from code, sometimes as another layer goes away, when nothing on the stage has the focus
          to tell them where they are: they are told it's the stage (3.5, 7.17). */}
      <LayerStageContext.Provider value={true}>
        <Dialog
          open={prompt !== null}
          onOpenChange={(o) => {
            if (!o) closePrompt();
          }}
          title={prompt?.mode === "pin" ? t("enterPin", { name: prompt.profile.name }) : prompt?.mode === "code" ? t("codeTitle") : t("enterPassword")}
          size="sm"
        >
          <form onSubmit={submitPrompt} className="space-y-4 text-start" noValidate>
            {prompt?.mode === "code" && (
              // Where the code went and for how long: the code itself is only in the mail, never on this page.
              <p className="text-body text-text-2">{codeSent ? t(codeSent.again ? "codeResent" : "codeSent") : t("codeIntro", { name: prompt.profile.name })}</p>
            )}
            {(prompt?.mode !== "code" || codeSent) && (
              <Field label={prompt?.mode === "pin" ? t("pin") : prompt?.mode === "code" ? t("codeLabel") : t("accountPassword")} error={error}>
                {(id, d, invalid) =>
                  prompt?.mode === "pin" ? (
                    <Input
                      id={id}
                      aria-describedby={d}
                      invalid={invalid}
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                      value={secret}
                      onChange={(e) => setSecret(e.target.value.replace(/[^0-9]/g, ""))}
                      className="text-center text-h3 tracking-widest"
                      maxLength={8}
                    />
                  ) : prompt?.mode === "code" ? (
                    // The sign-in's code field (two-step verification): six digits, centred, the phone's number pad.
                    <Input
                      key="code"
                      id={id}
                      aria-describedby={d}
                      invalid={invalid}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      spellCheck={false}
                      value={secret}
                      onChange={(e) => setSecret(e.target.value.replace(/\D/g, ""))}
                      className="text-center text-h3 tabular-nums tracking-widest"
                      maxLength={6}
                    />
                  ) : (
                    <PasswordInput id={id} aria-describedby={d} invalid={invalid} autoComplete="current-password" autoFocus value={secret} onChange={(e) => setSecret(e.target.value)} maxLength={200} />
                  )
                }
              </Field>
            )}
            {sendError && <InlineAlert tone="danger">{sendError}</InlineAlert>}
            {(prompt?.mode === "password" || (prompt?.mode === "code" && (codeSent || hasPassword))) && (
              // The other way to show it's the account: a mailed code, "Send again" after a minute, or the password.
              <div className="-ms-3 flex flex-wrap gap-x-2">
                {prompt.mode === "code" && codeSent && (
                  <Button variant="tertiary" size="sm" className="tabular-nums" disabled={resendIn > 0} loading={sending} onClick={() => void sendCode(prompt.profile)}>
                    {resendIn > 0 ? ta("resendIn", { time: clock(resendIn) }) : ta("resend")}
                  </Button>
                )}
                {prompt.mode === "password" ? (
                  <Button variant="tertiary" size="sm" onClick={() => switchProof("code")}>
                    {t("useCode")}
                  </Button>
                ) : (
                  hasPassword && (
                    <Button variant="tertiary" size="sm" onClick={() => switchProof("password")}>
                      {t("usePassword")}
                    </Button>
                  )
                )}
              </div>
            )}
            <DialogActions>
              <Button variant="secondary" onClick={closePrompt}>
                {tc("cancel")}
              </Button>
              {prompt?.mode === "code" && !codeSent ? (
                <Button loading={sending} onClick={() => void sendCode(prompt.profile)}>
                  {t("sendCode")}
                </Button>
              ) : (
                <Button type="submit" loading={busy}>
                  {t("switchTo")}
                </Button>
              )}
            </DialogActions>
          </form>
        </Dialog>

        {editing && (
          <ProfileEditor
            profile={editing === "new" ? null : editing}
            taken={profiles.map((p) => p.avatar)}
            canDelete={profiles.length > 1}
            focusPin={pinFirst}
            onClose={() => setEditing(null)}
            onSaved={(p, how) => {
              const list = how === "deleted" ? profiles.filter((x) => x.id !== p.id) : profiles.some((x) => x.id === p.id) ? profiles.map((x) => (x.id === p.id ? p : x)) : [...profiles, p];
              setProfiles(list);
              setEditing(null);
              // A new kids profile while an adult one has no PIN: offer to close the adult ones (as Netflix does). The
              // offer itself says the profile was created — a toast would sit on its buttons in a phone's sheet.
              if (how === "created" && p.isKids && adultWithoutPin(list)) setOffer({ open: true, name: p.name });
              else toast.success(t(how === "deleted" ? "deleted" : how === "created" ? "created" : "savedNamed", { name: p.name }));
              // The current profile gone: choose another one (the session has none now).
              if (how === "deleted" && p.id === currentId) window.location.href = to("/profiles");
            }}
          />
        )}

        <Dialog open={offer.open} onOpenChange={(open) => setOffer((o) => ({ ...o, open }))} title={t("pinOfferTitle")} size="sm">
          <p className="text-start text-body text-text-2">{t("pinOfferText", { name: offer.name })}</p>
          <DialogActions>
            <Button variant="secondary" onClick={() => setOffer((o) => ({ ...o, open: false }))}>
              {t("later")}
            </Button>
            <Button
              onClick={() => {
                setOffer((o) => ({ ...o, open: false }));
                if (noPin) edit(noPin, true);
              }}
            >
              {t("setPin")}
            </Button>
          </DialogActions>
        </Dialog>
      </LayerStageContext.Provider>
    </div>
  );
}
