"use client";

import { useTranslations } from "next-intl";
import { type ComponentProps, type ReactNode, type RefObject, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { type AuthError, authErrorKey } from "@/lib/api-errors";
import { authCall } from "./auth-call";
import type { SentScreen as SentScreenType } from "./SentScreen";

/*
 * What the sign-in screens share: the screen's frame, the checks, the way back (`next`), the
 * address carried from one screen to the next, the waits the API asks for, and the error under a form.
 */

export const MIN_PASSWORD = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// How long "Send again" waits after a letter went out.
export const RESEND_AFTER = 60;

export const localized = (locale: string, path: string) => (locale === "en" ? path : `/${locale}${path}`);
/** `?next=…` for links between the sign-in pages, so the way back survives every step. */
export const withNext = (path: string, next: string) => (next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`);

export type Errors = { email?: string; password?: string; form?: string };

/** The field an auth error is about: said there instead of under the form. */
export function fieldOf(key: string): "email" | "password" | null {
  if (key === "auth.errInvalidEmail" || key === "auth.errUserExists") return "email";
  if (key.startsWith("auth.errPassword")) return "password";
  return null;
}

export function useEmailCheck() {
  const t = useTranslations("auth");
  return (email: string) => (!email.trim() ? t("emailMissing") : !EMAIL.test(email.trim()) ? t("errInvalidEmail") : undefined);
}

/**
 * One screen: the h1, centred; `lead` — the one fact the screen is about (the address a letter went to); `about` — what
 * the screen is for, for a screen reader only (no visible explanations). Then the form or the actions.
 */
export function Screen({ title, lead, about, children }: { title: string; lead?: ReactNode; about?: string; children: ReactNode }) {
  return (
    <div className="animate-fade-up">
      <h1 className="text-balance text-center text-h2 text-text-1">{title}</h1>
      {lead && <p className="mt-3 text-balance text-center text-body text-text-2">{lead}</p>}
      {about && <p className="sr-only">{about}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}

// "Check your email" comes only after a letter went out, and so does its code (bundle budget): a form starts loading
// it as it sends (`preloadSent`) and waits for it before switching, so the form never gives way to an empty screen.
// Not React.lazy: a lazy component suspends on its first draw even when its code is already here.
let SentScreen: typeof SentScreenType | null = null;
const loadSent = () =>
  import("./SentScreen").then((m) => {
    SentScreen = m.SentScreen;
  });
/** Starts loading "Check your email"; resolves when it can be drawn, or when it couldn't load (`Sent` says so). */
export const preloadSent = () => loadSent().then(
  () => true,
  () => false,
);
export function Sent(props: ComponentProps<typeof SentScreenType>) {
  const tr = useTranslations();
  const [failed, setFailed] = useState(false);
  const [, loaded] = useState(false);
  const load = () => {
    setFailed(false);
    loadSent().then(
      () => loaded(true),
      () => setFailed(true),
    );
  };
  // Drawn without the preload (a reload of "Check your email" after sign-up): loaded here, drawn a moment later.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the screen opens
  useEffect(() => {
    if (!SentScreen) load();
  }, []);
  if (SentScreen) return <SentScreen {...props} />;
  // The letter went out, but this screen's code didn't come (the connection dropped): said, with "Retry".
  return failed ? (
    <InlineAlert
      tone="danger"
      action={
        <Button variant="tertiary" size="sm" onClick={load}>
          {tr("common.retry")}
        </Button>
      }
    >
      {tr("errors.network")}
    </InlineAlert>
  ) : null;
}

const EMAIL_KEY = "lumovio:auth-email";

/** The address typed on one sign-in screen goes with the person to the next one in this tab (sign in → forgot → sign up). */
export function rememberEmail(email: string | null) {
  try {
    if (email?.trim()) sessionStorage.setItem(EMAIL_KEY, email.trim());
    else sessionStorage.removeItem(EMAIL_KEY);
  } catch {
    // Without storage the next screen just starts empty.
  }
}

/**
 * The carried address fills the email field; on a computer the cursor goes where typing continues — the address, or
 * the password once the address is there. A phone isn't focused: its keyboard would cover the screen at once.
 */
export function useCarriedEmail(
  setEmail: (email: string) => void,
  email: RefObject<HTMLInputElement | null>,
  then?: RefObject<HTMLInputElement | null>,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the screen opens
  useEffect(() => {
    let carried = "";
    try {
      carried = sessionStorage.getItem(EMAIL_KEY) ?? "";
    } catch {}
    if (carried) setEmail(carried);
    if (!matchMedia("(pointer: fine)").matches) return;
    (carried && then ? then : email).current?.focus();
  }, []);
}

/** Seconds left until `until` (ms), ticking; 0 once it has passed or without one. */
export function useCountdown(until: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (until === null) return setLeft(0);
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);
  return left;
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** A wait the API asked for (429): the seconds left and `hold(seconds)` to start one. */
export function useWait() {
  const [until, setUntil] = useState<number | null>(null);
  const left = useCountdown(until);
  return [left, (seconds: number) => setUntil(Date.now() + seconds * 1000)] as const;
}

type AuthFetch = { headers: Record<string, string>; onError: (ctx: { response: Response }) => void };

/**
 * A Better Auth call with its fetch options. The error comes back as a message key — a 5xx is "Lumovio is unavailable",
 * not "something went wrong" — and a refusal for too many attempts with the seconds the API asks to wait
 * (its X-Retry-After), so the screen can count them down instead of saying "wait a little".
 */
export async function attempt<T extends { error: AuthError | null }>(run: (options: AuthFetch) => Promise<T>, headers: Record<string, string> = {}) {
  let wait = 0;
  const onError = ({ response }: { response: Response }) => {
    wait = response.status === 429 ? Number(response.headers.get("x-retry-after")) || 0 : 0;
  };
  const res = await authCall(() => run({ headers, onError }));
  const err = res.error;
  const key = !err ? null : (err.status ?? 0) >= 500 ? "auth.errUnavailable" : authErrorKey(err);
  return { res, key, wait: err ? wait : 0 };
}

/**
 * The error under a form: a wait the API asked for, counted down (the screen reader hears the time once, not every
 * second), or the error's text; `action` — the way out it offers ("Sign in" when the address already has an account).
 */
export function FormError({ text, wait, action }: { text?: string; wait: number; action?: ReactNode }) {
  if (wait > 0) return <WaitAlert wait={wait} />;
  return text ? (
    <InlineAlert tone="danger" action={action}>
      {text}
    </InlineAlert>
  ) : null;
}

function WaitAlert({ wait }: { wait: number }) {
  const t = useTranslations("auth");
  // The alert is announced when it appears; its ticking time stays out of the screen reader's way.
  const [heard] = useState(wait);
  return (
    <InlineAlert tone="danger">
      <span aria-hidden className="tabular-nums">
        {t("errTooManyWait", { time: clock(wait) })}
      </span>
      <span className="sr-only">{t("errTooManyWait", { time: clock(heard) })}</span>
    </InlineAlert>
  );
}
