"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, PasswordInput } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { Link as IntlLink } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { useAuthCaptcha } from "./captcha";
import { nameFromEmail } from "./email";
import { type SocialProvider, SocialButtons } from "./SocialButtons";
import {
  attempt,
  type Errors,
  FormError,
  fieldOf,
  localized,
  MIN_PASSWORD,
  preloadSent,
  rememberEmail,
  Screen,
  Sent,
  useCarriedEmail,
  useEmailCheck,
  useWait,
  withNext,
} from "./shared";

const SENT_KEY = "lumovio:signup-sent";
type SentState = { email: string; at: number; next: string };

function readSent(): SentState | null {
  try {
    const raw = sessionStorage.getItem(SENT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SentState;
    return Date.now() - s.at < 24 * 3600_000 ? s : null;
  } catch {
    return null;
  }
}
function writeSent(s: SentState | null) {
  try {
    if (s) sessionStorage.setItem(SENT_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SENT_KEY);
  } catch {
    // Without storage the "Check your email" step only doesn't survive a reload.
  }
}

/**
 * Sign-up: the providers, the address and a password, "Create account", the terms; "Sign in" at the end. An
 * address that already has an account says so with "Sign in" right there — the address goes along. With the e-mail
 * confirmation on, "Check your email" follows (and survives a reload in this tab). Registration closed by an admin
 * (Admin → Management → Settings) is said before anyone fills anything — the page knows it from the server.
 */
export function SignUpForm({ providers, closed }: { providers?: SocialProvider[] | null; closed?: boolean }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const locale = useLocale();
  const next = safeNext(useSearchParams().get("next"));
  const checkEmail = useEmailCheck();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [exists, setExists] = useState(false);
  const [sent, setSent] = useState<SentState | null>(null);
  const [wait, hold] = useWait();
  const captcha = useAuthCaptcha();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  useCarriedEmail(setEmail, emailRef, passwordRef);
  // "Check your email" survives a reload of the page in this tab.
  useEffect(() => setSent(readSent()), []);
  const after = localized(locale, withNext("/profiles", next));
  const signIn = withNext("/auth/sign-in", next);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = {
      email: checkEmail(email),
      password: password.length >= MIN_PASSWORD ? undefined : password ? t("errPasswordShort") : t("passwordMissing"),
    };
    if (!found.email && !found.password && captcha.missing) found.form = tr("support.errCaptcha");
    setErrors(found);
    setExists(false);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    if (found.form) return;
    setBusy(true);
    const sentReady = preloadSent();
    const address = email.trim();
    const { res, key, wait } = await attempt(
      (o) => authClient.signUp.email({ email: address, password, name: nameFromEmail(address), callbackURL: after }, o),
      { "x-lumovio-locale": locale, ...captcha.headers() },
    );
    captcha.spent();
    setBusy(false);
    if (key) {
      if (wait) return hold(wait);
      // The address has an account: said under the form with "Sign in", which takes the address along.
      if (key === "auth.errUserExists") return setExists(true);
      const field = fieldOf(key);
      setErrors(field ? { [field]: tr(key) } : { form: tr(key) });
      if (field === "email") emailRef.current?.focus();
      else if (field === "password") passwordRef.current?.select();
      return;
    }
    if (res.data?.token) {
      rememberEmail(null);
      window.location.href = after;
      return;
    }
    const s = { email: address, at: Date.now(), next };
    writeSent(s);
    await sentReady;
    setPassword("");
    setSent(s);
  };

  if (sent)
    return (
      <Sent
        email={sent.email}
        text={t("checkEmailText", { email: sent.email })}
        sentAt={sent.at}
        send={async () => {
          const { key, wait } = await attempt((o) =>
            authClient.sendVerificationEmail({ email: sent.email, callbackURL: localized(locale, withNext("/profiles", sent.next)) }, o),
          );
          return { key, wait };
        }}
        onSent={(at) => {
          const s = { ...sent, at };
          writeSent(s);
          setSent(s);
        }}
        onChange={() => {
          setEmail(sent.email);
          writeSent(null);
          setSent(null);
        }}
        back={
          <p className="mt-6 text-center">
            <Link variant="action" href={withNext("/auth/sign-in", sent.next)}>
              {t("backToSignIn")}
            </Link>
          </p>
        }
      />
    );

  if (closed)
    return (
      <Screen title={t("registrationClosedTitle")} about={t("registrationClosedText")}>
        <IntlLink href={signIn} className={buttonClass("primary", "lg", "w-full")}>
          {tc("signIn")}
        </IntlLink>
      </Screen>
    );

  return (
    <Screen title={t("signUpTitle")} about={t("signUpSubtitle")}>
      <SocialButtons next={after} providers={providers} />
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        <Field label={t("email")} error={errors.email}>
          {(id, d, invalid) => (
            <Input
              ref={emailRef}
              id={id}
              aria-describedby={d}
              invalid={invalid || exists}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              size="lg"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setExists(false);
                rememberEmail(e.target.value);
              }}
            />
          )}
        </Field>
        <Field label={t("password")} hint={t("passwordHint")} error={errors.password}>
          {(id, d, invalid) => (
            <PasswordInput
              ref={passwordRef}
              id={id}
              aria-describedby={d}
              invalid={invalid}
              autoComplete="new-password"
              size="lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {captcha.widget}
        <FormError
          text={exists ? tr("auth.errUserExists") : errors.form}
          wait={wait}
          action={
            exists && (
              <IntlLink href={signIn} className={buttonClass("tertiary", "sm")}>
                {tc("signIn")}
              </IntlLink>
            )
          }
        />
        <Button type="submit" className="mt-2 w-full" size="lg" loading={busy} disabled={wait > 0}>
          {tc("signUp")}
        </Button>
        <p className="text-balance text-center text-caption text-text-3">
          {t.rich("terms", {
            terms: (c) => (
              <Link href="/legal/terms" className="py-3.5">
                {c}
              </Link>
            ),
            privacy: (c) => (
              <Link href="/legal/privacy" className="py-3.5">
                {c}
              </Link>
            ),
          })}
        </p>
      </form>
      <p className="mt-10 text-center text-body-s text-text-2">
        {t("haveAccount")}{" "}
        <Link variant="action" href={signIn}>
          {tc("signIn")}
        </Link>
      </p>
    </Screen>
  );
}
