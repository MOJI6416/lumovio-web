"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, PasswordInput } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { useAuthCaptcha } from "./captcha";
import { type SocialProvider, SocialButtons } from "./SocialButtons";
import {
  attempt,
  type Errors,
  FormError,
  fieldOf,
  localized,
  preloadSent,
  rememberEmail,
  Screen,
  Sent,
  useCarriedEmail,
  useEmailCheck,
  useWait,
  withNext,
} from "./shared";

/**
 * Sign-in: the providers, then the address and the password, "Sign in"; under it "Forgot password?" and, at
 * the end, "Create account" for someone new. One model of checking: the button is always on, Enter sends, the
 * check runs on submit, an error is said at its field and focuses it; a wrong pair selects the password so it is
 * typed again at once. An address that isn't confirmed yet opens "Check your email" — the API has just sent a new
 * link (sendOnSignIn) — instead of an error under the form.
 */
export function SignInForm({ providers }: { providers?: SocialProvider[] | null }) {
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
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [wait, hold] = useWait();
  const captcha = useAuthCaptcha();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  useCarriedEmail(setEmail, emailRef, passwordRef);
  // Who's watching first, then back where the person came from.
  const after = localized(locale, withNext("/profiles", next));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = { email: checkEmail(email), password: password ? undefined : t("passwordMissing") };
    if (!found.email && !found.password && captcha.missing) found.form = tr("support.errCaptcha");
    setErrors(found);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    if (found.form) return;
    setBusy(true);
    const sentReady = preloadSent();
    const { res, key, wait } = await attempt(
      (o) => authClient.signIn.email({ email: email.trim(), password, callbackURL: after }, o),
      captcha.headers(),
    );
    captcha.spent();
    if (!key) {
      if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) return; // the plugin opens the code step
      rememberEmail(null);
      window.location.href = after;
      return;
    }
    setBusy(false);
    if (key === "auth.notVerified") return sentReady.then(() => setSentAt(Date.now()));
    if (wait) return hold(wait);
    const field = fieldOf(key);
    setErrors(field ? { [field]: tr(key) } : { form: tr(key) });
    if (field === "email") emailRef.current?.focus();
    else if (key === "auth.invalidCredentials" || field === "password") passwordRef.current?.select();
  };

  if (sentAt)
    return (
      <Sent
        email={email.trim()}
        text={t("checkEmailText", { email: email.trim() })}
        sentAt={sentAt}
        send={async () => {
          const { key, wait } = await attempt((o) => authClient.sendVerificationEmail({ email: email.trim(), callbackURL: after }, o));
          return { key, wait };
        }}
        onSent={setSentAt}
        onChange={() => {
          setPassword("");
          setSentAt(null);
        }}
      />
    );

  return (
    <Screen title={t("signInTitle")} about={t("signInSubtitle")}>
      <SocialButtons next={after} providers={providers} />
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        <Field label={t("email")} error={errors.email}>
          {(id, d, invalid) => (
            <Input
              ref={emailRef}
              id={id}
              aria-describedby={d}
              invalid={invalid}
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              size="lg"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                rememberEmail(e.target.value);
              }}
            />
          )}
        </Field>
        <Field label={t("password")} error={errors.password}>
          {(id, d, invalid) => (
            <PasswordInput
              ref={passwordRef}
              id={id}
              aria-describedby={d}
              invalid={invalid}
              autoComplete="current-password"
              size="lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {captcha.widget}
        <FormError text={errors.form} wait={wait} />
        <Button type="submit" className="mt-2 w-full" size="lg" loading={busy} disabled={wait > 0}>
          {tc("signIn")}
        </Button>
      </form>
      <p className="mt-3 text-center">
        <Link variant="action" href={withNext("/auth/forgot", next)}>
          {t("forgot")}
        </Link>
      </p>
      {/* Someone new usually comes by "Create account" itself (the gate, the home page); here it is the way across. */}
      <p className="mt-10 text-center text-body-s text-text-2">
        {t("noAccount")}{" "}
        <Link variant="action" href={withNext("/auth/sign-up", next)}>
          {tc("signUp")}
        </Link>
      </p>
    </Screen>
  );
}
