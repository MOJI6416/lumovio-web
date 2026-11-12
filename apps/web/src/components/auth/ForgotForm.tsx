"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { useAuthCaptcha } from "./captcha";
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
 * "Forgot password?": the address — already there when it was typed on the sign-in screen — and "Send link",
 * then "Check your email". The answer is the same whether or not the account exists (no account enumeration); a
 * refused or lost request (a bad address, too many requests, offline) says so instead of pretending it was sent.
 */
export function ForgotForm() {
  const t = useTranslations("auth");
  const tr = useTranslations();
  const locale = useLocale();
  const next = safeNext(useSearchParams().get("next"));
  const checkEmail = useEmailCheck();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [wait, hold] = useWait();
  const captcha = useAuthCaptcha();
  const emailRef = useRef<HTMLInputElement>(null);
  useCarriedEmail(setEmail, emailRef);

  const send = async () => {
    const res = await attempt(
      (o) => authClient.requestPasswordReset({ email: email.trim(), redirectTo: localized(locale, "/auth/reset") }, o),
      captcha.headers(),
    );
    captcha.spent();
    return res;
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = { email: checkEmail(email) };
    if (!found.email && captcha.missing) found.form = tr("support.errCaptcha");
    setErrors(found);
    if (found.email) return emailRef.current?.focus();
    if (found.form) return;
    setBusy(true);
    const sentReady = preloadSent();
    const { key, wait } = await send();
    setBusy(false);
    if (!key) return sentReady.then(() => setSentAt(Date.now()));
    if (wait) return hold(wait);
    setErrors(fieldOf(key) === "email" ? { email: tr(key) } : { form: tr(key) });
  };
  const back = (
    <p className="mt-6 text-center">
      <Link variant="action" href={withNext("/auth/sign-in", next)}>
        {t("backToSignIn")}
      </Link>
    </p>
  );

  if (sentAt)
    return (
      <Sent
        email={email.trim()}
        text={t("forgotSentText", { email: email.trim() })}
        sentAt={sentAt}
        send={async () => {
          // "Send again" is a reset request too: it needs its own check.
          if (captcha.missing) return { key: "support.errCaptcha", wait: 0 };
          const { key, wait } = await send();
          return { key, wait };
        }}
        onSent={setSentAt}
        onChange={() => setSentAt(null)}
        extra={captcha.widget}
        back={back}
      />
    );

  return (
    <Screen title={t("forgotTitle")} about={t("forgotText")}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} noValidate>
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
        {captcha.widget}
        <FormError text={errors.form} wait={wait} />
        <Button type="submit" className="mt-2 w-full" size="lg" loading={busy} disabled={wait > 0}>
          {t("sendLink")}
        </Button>
      </form>
      {back}
    </Screen>
  );
}
