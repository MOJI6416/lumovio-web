"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { Link as IntlLink } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { attempt, type Errors, FormError, fieldOf, MIN_PASSWORD, Screen, useWait } from "./shared";

/**
 * A new password from the e-mailed link: without a token, with an expired one (`?error=INVALID_TOKEN`
 * from the link) or one refused on save, the screen says the link doesn't work and offers a new one — not a form that
 * fails after the password is typed. Done — "Sign in" with the new password.
 */
export function ResetForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [wait, hold] = useWait();
  const [state, setState] = useState<"form" | "invalid" | "done">(!token || params.get("error") ? "invalid" : "form");
  const passwordRef = useRef<HTMLInputElement>(null);

  if (state === "invalid")
    return (
      <Screen title={t("resetInvalidTitle")} about={t("resetInvalidText")}>
        <IntlLink href="/auth/forgot" className={buttonClass("primary", "lg", "w-full")}>
          {t("sendNewLink")}
        </IntlLink>
        <p className="mt-6 text-center">
          <Link variant="action" href="/auth/sign-in">
            {t("backToSignIn")}
          </Link>
        </p>
      </Screen>
    );
  if (state === "done")
    return (
      <Screen title={t("resetDoneTitle")} about={t("resetDoneText")}>
        <IntlLink href="/auth/sign-in" className={buttonClass("primary", "lg", "w-full")}>
          {tc("signIn")}
        </IntlLink>
      </Screen>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = password.length >= MIN_PASSWORD ? undefined : password ? t("errPasswordShort") : t("passwordMissing");
    setErrors({ password: found });
    if (found) return passwordRef.current?.focus();
    setBusy(true);
    const { key, wait } = await attempt((o) => authClient.resetPassword({ newPassword: password, token }, o));
    setBusy(false);
    if (!key) return setState("done");
    if (key === "auth.errLinkExpired") return setState("invalid");
    if (wait) return hold(wait);
    setErrors(fieldOf(key) === "password" ? { password: tr(key) } : { form: tr(key) });
    if (fieldOf(key) === "password") passwordRef.current?.select();
  };
  return (
    <Screen title={t("resetTitle")} about={t("resetText")}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <Field label={t("newPassword")} hint={t("passwordHint")} error={errors.password}>
          {(id, d, invalid) => (
            <PasswordInput
              ref={passwordRef}
              id={id}
              aria-describedby={d}
              invalid={invalid}
              autoComplete="new-password"
              size="lg"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <FormError text={errors.form} wait={wait} />
        <Button type="submit" className="mt-2 w-full" size="lg" loading={busy} disabled={wait > 0}>
          {t("savePassword")}
        </Button>
      </form>
    </Screen>
  );
}
