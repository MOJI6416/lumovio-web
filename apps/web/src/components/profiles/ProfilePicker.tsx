"use client";

import type { LeaveCodeSent, Me, PinHintState, Profile, SetupOffer } from "@lumovio/contracts";
import { clsx } from "clsx";
import { Lock, LogOut, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { BrandLoader } from "@/components/ui/BrandMotion";
import { Button, buttonClass } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input, PasswordInput } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { LOCALE_CODES } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { ApiRequestError, api } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";
import { codeSendErrorText, profileErrorText } from "./profile-errors";

// Manage profiles and a profile's page load when they are opened (or the browser is idle): the choice stays light.
const loadManager = () => import("./ProfileManager");
const loadEditor = () => import("./ProfileEditor");
const ManageView = dynamic(() => loadManager().then((m) => m.ManageView));
const CreateProfile = dynamic(() => loadManager().then((m) => m.CreateProfile), { ssr: false });
const PinOffer = dynamic(() => loadManager().then((m) => m.PinOffer), { ssr: false });
const EditView = dynamic(() => loadEditor().then((m) => m.EditView));

/** How many profiles an account can have (the API's limit). */
export const MAX_PROFILES = 8;

/**
 * What switching to a protected profile asks for: its PIN, or — leaving a kids profile for an adult one without a PIN —
 * the account password or a code mailed to the account. An account without a password (social sign-in only) gets the
 * code straight away; one with it starts at the password and can take the code instead.
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
 * A history entry this page pushed from one of its own views: the view it came from (its "Back" goes back to it) and
 * whether "Who's watching?" was on the way here (Manage profiles then goes back to it rather than to `next`).
 */
const PUSHED = "lumovioProfiles";
type Pushed = { from: string; picker: boolean };
const pushed = () => ((window.history.state as Record<string, unknown> | null)?.[PUSHED] as Pushed | undefined) ?? null;
const isPicker = (search: string) => !new URLSearchParams(search).has("manage");

/**
 * The three views of /profiles (the Picker template): "Who's watching?" (`/profiles`), Manage
 * profiles (`?manage=1`) and a profile's page (`?manage=1&edit=<id>`). Each has its own address, so the browser's Back,
 * a reload and a link from the account menu or the settings land on it; moving between them changes the address in
 * place, without a trip to the server.
 */
function useViews(inKids: boolean) {
  const params = useSearchParams();
  const manage = params.get("manage") === "1" && !inKids;
  const edit = manage ? params.get("edit") : null;
  // "Who's watching?" was on the way to this view (false: the page was opened here — from the menu, the settings).
  const [viaPicker, setViaPicker] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: read again each time the view changes
  useEffect(() => setViaPicker(pushed()?.picker ?? false), [params]);
  /** To `search` (this page): back, when it is the view this one was pushed from; a new entry otherwise. */
  const go = (search: string) => {
    const was = pushed();
    if (was?.from === search) return window.history.back();
    const here = window.location.search;
    // Only our own key: Next.js adds its router state itself and then moves useSearchParams (a state that carries
    // Next's keys already is taken for its own call and left alone).
    const state: Pushed = { from: here, picker: Boolean(was?.picker) || isPicker(here) };
    window.history.pushState({ [PUSHED]: state }, "", `${window.location.pathname}${search}`);
  };
  /** A plain click on a link to this page changes the view in place; a modified one (new tab) stays the link's own. */
  const onClickCapture = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest("a[href]");
    if (!(a instanceof HTMLAnchorElement) || a.target) return;
    const to = new URL(a.href);
    if (to.origin !== window.location.origin || to.pathname !== window.location.pathname) return;
    e.preventDefault();
    go(to.search);
  };
  return { params, manage, edit, viaPicker, go, onClickCapture };
}

/** `/profiles` with this query (the `next` of the page kept), as a link of the site gives it (next-intl adds the locale). */
function viewHref(next: string, query: Record<string, string>) {
  const q = new URLSearchParams(query);
  if (next !== "/") q.set("next", next);
  const s = q.toString();
  return `/profiles${s ? `?${s}` : ""}`;
}

/**
 * "Who's watching?": only the choice — the question, the profiles'
 * faces and names (a lock where a PIN is asked, "Kids" under a kids profile, the current one ringed), "Add profile" as a
 * tile while there is room, then "Manage profiles" and "Sign out". One press opens the profile in its own interface
 * language, through the account menu's moment: the chosen face on the stage with the loader. A session
 * without a profile and an account of one profile without a PIN skip the question. Manage profiles and a profile's page
 * are views of this page (`ProfileManager`, `ProfileEditor`).
 */
export function ProfilePicker({ me, pinHint, setup = null }: { me: Me; pinHint: PinHintState | null; setup?: SetupOffer }) {
  const t = useTranslations("profiles");
  const tc = useTranslations("common");
  // The code field and "Send again" say what the sign-in's code steps say.
  const ta = useTranslations("auth");
  const locale = useLocale();
  // A kids profile doesn't manage profiles: the address alone doesn't open those views.
  const inKids = me.activeProfile?.isKids ?? false;
  const { params, manage, edit, viaPicker, go: goView, onClickCapture } = useViews(inKids);
  const next = safeNext(params.get("next"), "/");
  const [profiles, setProfiles] = useState(me.profiles);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Just signed in to an account of one profile without a PIN: there is nobody else to choose (as Apple TV) — the page
  // opens on the switching moment itself, so no grid flashes before it.
  const only = me.profiles.length === 1 ? me.profiles[0]! : null;
  const straightIn = !me.activeProfile && !manage && !params.get("switch") && only && !only.hasPin ? only : null;
  const [switching, setSwitching] = useState<Profile | null>(straightIn);
  const [creating, setCreating] = useState(false);
  // "Add profile" opened by the address (the account menu's "+", `?add=1`): giving it up goes back to where it came from.
  const [addByLink, setAddByLink] = useState(false);
  // A kids profile was just created while an adult one has no PIN: "Set a PIN on adult profiles?" (`name`: the new one).
  const [offer, setOffer] = useState<string | null>(null);
  // "Set PIN" (the hint, the offer): the profile's page opens with its PIN dialog.
  const [pinFirst, setPinFirst] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState<CodeSent>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const resendIn = useSecondsLeft(codeSent?.until ?? null);
  const currentId = me.activeProfile?.id;
  // Social sign-in only: there is no account password to type.
  const hasPassword = me.linkedProviders.includes("credential");
  const limit = me.maxProfiles ?? MAX_PROFILES;
  const full = profiles.length >= limit;

  const to = (path: string, lang = locale) => (lang === "en" ? path : `/${lang}${path === "/" ? "" : path}`);
  // The profile's own interface language, when it has one, is the site's language from here on. A new account on its
  // way home goes through the first run's screen once; one going to a page of its own (a title, an invitation) gets there.
  const go = (p: Profile) => {
    const lang = p.uiLocale && (LOCALE_CODES as readonly string[]).includes(p.uiLocale) ? p.uiLocale : locale;
    window.location.href = to(setup === "screen" && !p.isKids && next === "/" ? "/setup" : next, lang);
  };
  const manageHref = viewHref(next, { manage: "1" });
  const editHref = (id: string) => viewHref(next, { manage: "1", edit: id });
  /** Opens a view from code (after creating a profile, "Set PIN"), as its link would. */
  const open = (href: string) => goView(href.slice(href.indexOf("?")));
  // Manage profiles reached through "Who's watching?" goes back to it; opened from elsewhere (the account menu, the
  // settings), back there — `next`.
  const manageBack = viaPicker ? viewHref(next, {}) : next;

  async function select(p: Profile, extra: { pin?: string; password?: string; code?: string } = {}) {
    setBusy(true);
    setError(null);
    // The account menu's moment: the chosen face on the stage while the session changes hands.
    if (!prompt) setSwitching(p);
    try {
      await api("/api/profiles/select", { method: "POST", json: { profileId: p.id, ...extra } });
      setSwitching(p);
      go(p);
    } catch (e) {
      setSwitching(null);
      const asked = e instanceof ApiRequestError && (e.code === "pin_required" || e.code === "password_required");
      const mode = e instanceof ApiRequestError && e.code === "pin_required" ? "pin" : hasPassword ? "password" : "code";
      if (prompt) setError(profileErrorText(t, e, prompt.mode));
      else if (asked) setPrompt({ profile: p, mode });
      else toast.error(profileErrorText(t, e, "pin"));
      setBusy(false);
    }
  }

  /** What a press on a profile asks first, known here: its PIN, or — leaving a kids profile — the account's proof. */
  const choose = (p: Profile) => {
    if (busy) return;
    if (p.hasPin) setPrompt({ profile: p, mode: "pin" });
    else if (inKids && !p.isKids) setPrompt({ profile: p, mode: hasPassword ? "password" : "code" });
    else void select(p);
  };

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on arrival
  useEffect(() => {
    // From the account menu (/profiles?switch=<id>): that profile, its PIN asked here.
    const id = params.get("switch");
    const p = id ? profiles.find((x) => x.id === id) : null;
    if (p) return choose(p);
    if (straightIn) void select(straightIn);
    // From the account menu's "+" (/profiles?add=1): the new profile's first step at once, over "Who's watching?" —
    // not Manage profiles first. The address loses `add`, so Back and a reload don't open it again.
    if (params.get("add") === "1" && !inKids && !full) {
      const url = new URL(window.location.href);
      url.searchParams.delete("add");
      window.history.replaceState(window.history.state, "", url);
      setAddByLink(true);
      setCreating(true);
    }
    // The views behind "Manage profiles" come in the browser's spare time, so the press finds them here.
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
    if (!inKids) idle(() => void loadManager().then(() => loadEditor()));
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

  const editing = edit ? profiles.find((p) => p.id === edit) : undefined;
  // A new view is a new page to the person: it starts at the top, and the focus is on its heading — where a screen
  // reader reads from and the keyboard goes on from. Not on arrival: the page itself starts there.
  const view = editing ? editing.id : manage ? "manage" : "pick";
  const arrived = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the view changes, which is all `view` is for
  useEffect(() => {
    if (!arrived.current) {
      arrived.current = true;
      return;
    }
    window.scrollTo(0, 0);
    let tries = 0;
    let frame = 0;
    // A view whose module is still coming has no heading yet: look again for a moment.
    const find = () => {
      const h = document.querySelector<HTMLElement>("#main h1");
      if (h) {
        h.tabIndex = -1;
        h.focus({ preventScroll: true });
      } else if (tries++ < 60) frame = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frame);
  }, [view]);
  const onCreated = (p: Profile, list: Profile[], askPin: boolean) => {
    setProfiles(list);
    setCreating(false);
    setAddByLink(false);
    open(editHref(p.id));
    // A new kids profile while an adult one has no PIN: offer to close the adult ones (as Disney+ does). The offer
    // itself says the profile was created — a toast would sit on its buttons in a phone's sheet.
    if (askPin) setOffer(p.name);
    else toast.success(t("created", { name: p.name }));
  };
  const setPinOn = (p: Profile) => {
    setPinFirst(p.id);
    open(editHref(p.id));
  };

  return (
    // Catches the plain clicks on its own links (a view of this page): each stays a link of its own.
    <div onClickCapture={onClickCapture} className="[&_h1]:outline-none">
      {editing ? (
        <EditView
          key={editing.id}
          profile={editing}
          profiles={profiles}
          current={editing.id === currentId}
          backHref={manageHref}
          focusPin={pinFirst === editing.id}
          onPinShown={() => setPinFirst(null)}
          onChange={(p) => setProfiles((list) => list.map((x) => (x.id === p.id ? p : x)))}
          onDeleted={(p) => {
            setProfiles((list) => list.filter((x) => x.id !== p.id));
            toast.success(t("deleted", { name: p.name }));
            // The current profile gone: the session has none now — choose another one.
            if (p.id === currentId) window.location.href = to("/profiles");
            else open(manageHref);
          }}
        />
      ) : manage ? (
        <ManageView
          profiles={profiles}
          currentId={currentId}
          limit={limit}
          pinHint={pinHint}
          backHref={manageBack}
          editHref={editHref}
          onAdd={() => setCreating(true)}
          onSetPin={setPinOn}
        />
      ) : (
        // From `sm` the question and the faces stand in the middle of the screen, a little above its centre.
        <div className="flex flex-col items-center text-center sm:min-h-[calc(100dvh-var(--header-h)-7rem)] sm:justify-center sm:pb-16">
          <h1 className="text-balance text-h1 text-text-1">{t("whoIsWatching")}</h1>
          {/* Leaving a kids profile: what it takes is said by the dialog that asks for it. */}
          {inKids && <p className="sr-only">{hasPassword ? t("leaveKidsHint") : t("leaveKidsHintNoPassword")}</p>}
          <ul
            // The faces: 88 in three columns on a phone (eight profiles and "Add" in the first screen), 120 from `sm`,
            // 136 from `xl` — five to a row in the page.
            className="mt-8 grid w-full max-w-sm grid-cols-3 justify-items-center gap-x-2 gap-y-6 [--pick:88px] sm:mt-12 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-10 sm:[--pick:120px] xl:[--pick:136px]"
          >
            {profiles.map((p) => {
              const current = p.id === currentId;
              return (
                <li key={p.id} className="w-full sm:w-36 xl:w-40">
                  <button /* ui-lint-ignore raw-button: a profile tile (its face and name) */
                    type="button"
                    // Not `disabled` while a choice is in flight: a disabled button drops the focus, and the PIN or
                    // password dialog that follows would have nowhere to give it back on Escape.
                    aria-disabled={busy || undefined}
                    aria-current={current ? "true" : undefined}
                    onClick={() => choose(p)}
                    className="group/pp flex w-full flex-col items-center gap-2 rounded-md p-1 outline-offset-4 sm:gap-3 sm:p-2"
                  >
                    <span
                      className={clsx(
                        "relative rounded-avatar transition duration-200 group-hover/pp:scale-105 group-focus-visible/pp:scale-105 motion-reduce:transform-none",
                        // The current profile: a ring around the circle (a shape, not only a colour).
                        current && "outline-2 outline-offset-4 outline-text-1 outline-solid",
                      )}
                    >
                      <ProfileAvatar avatar={p.avatar} photo={p.photo} name={p.name} size="var(--pick)" />
                      {p.hasPin && (
                        <span aria-hidden className="absolute -end-1 -bottom-1 grid size-7 place-items-center rounded-full border-2 border-bg bg-surface-3 text-text-1 sm:size-8">
                          <Lock className="size-3.5 sm:size-4" />
                        </span>
                      )}
                    </span>
                    {/* A long name takes a second line on a phone rather than losing its end. */}
                    <span className="line-clamp-2 max-w-full break-words text-body text-text-2 group-hover/pp:text-text-1 sm:line-clamp-1 sm:text-title">
                      {p.name}
                      {/* The name first, then what the marks say (a screen reader hears the tile in that order). */}
                      {current && <span className="sr-only"> · {t("current")}</span>}
                      {p.hasPin && <span className="sr-only"> · {t("locked")}</span>}
                    </span>
                    {p.isKids && <Tag className="-mt-1">{t("kidsTag")}</Tag>}
                  </button>
                </li>
              );
            })}
            {!inKids && !full && (
              // At the limit there is no tile (as Netflix): Manage profiles says why "Add profile" is off.
              <li className="w-full sm:w-36 xl:w-40">
                <button /* ui-lint-ignore raw-button: the "Add profile" tile */
                  type="button"
                  disabled={busy}
                  onClick={() => setCreating(true)}
                  onPointerEnter={() => void loadManager()}
                  className="group/pp flex w-full flex-col items-center gap-2 rounded-md p-1 outline-offset-4 sm:gap-3 sm:p-2"
                >
                  <span className="grid size-(--pick) place-items-center rounded-avatar border-2 border-line-2 text-text-2 transition-colors duration-fast ease-fast group-hover/pp:border-text-3 group-hover/pp:text-text-1">
                    <Plus aria-hidden className="size-8 sm:size-10" />
                  </span>
                  <span className="text-body text-text-2 group-hover/pp:text-text-1 sm:text-title">{t("add")}</span>
                </button>
              </li>
            )}
          </ul>

          <div className="mt-10 flex flex-col items-center gap-2 sm:mt-14">
            {!inKids && (
              <Link href={manageHref} className={buttonClass("secondary")} onPointerEnter={() => void loadManager()}>
                {t("manage")}
              </Link>
            )}
            {/* Not on a TV: signing out there is in the TV's settings, and the TV keeps its own shell. */}
            <Button variant="tertiary" icon={LogOut} loading={busy && !prompt && !switching} onClick={() => void signOut()} className="in-data-[tv=1]:hidden">
              {tc("signOut")}
            </Button>
          </div>
        </div>
      )}

      {/* The PIN, password or code dialog: the profile's face over the field, so it is clear whose it is. */}
      <Dialog
        open={prompt !== null}
        onOpenChange={(o) => {
          if (!o) closePrompt();
        }}
        title={prompt?.mode === "pin" ? t("enterPin", { name: prompt.profile.name }) : prompt?.mode === "code" ? t("codeTitle") : t("enterPassword")}
        size="sm"
      >
        <form onSubmit={submitPrompt} className="space-y-4 text-start" noValidate>
          {prompt && (
            <div className="flex justify-center pb-2">
              <ProfileAvatar avatar={prompt.profile.avatar} photo={prompt.profile.photo} name={prompt.profile.name} size={72} />
            </div>
          )}
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

      {creating && (
        <CreateProfile
          profiles={profiles}
          onClose={() => {
            setCreating(false);
            if (!addByLink) return;
            // Opened from the account menu: back to the page the menu was on (the history's, or `next`).
            const nav = (window as Window & { navigation?: { canGoBack?: boolean } }).navigation;
            if (nav?.canGoBack ?? window.history.length > 1) window.history.back();
            else window.location.href = to(next);
          }}
          onCreated={onCreated}
        />
      )}
      {offer !== null && (
        <PinOffer
          name={offer}
          profiles={profiles}
          onClose={() => setOffer(null)}
          onSetPin={(p) => {
            setOffer(null);
            setPinOn(p);
          }}
        />
      )}

      {switching && (
        // As the account menu does it: the chosen profile on the stage, over everything,
        // while the page opens.
        <div role="status" aria-label={tc("loading")} className="stage fixed inset-0 z-scrim grid animate-fade-in place-items-center bg-stage">
          <div className="flex flex-col items-center gap-8">
            <ProfileAvatar avatar={switching.avatar} photo={switching.photo} name={switching.name} size={96} />
            <BrandLoader size="md" />
          </div>
        </div>
      )}
    </div>
  );
}
