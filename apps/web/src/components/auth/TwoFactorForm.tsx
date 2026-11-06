"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { Link as IntlLink } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { attempt, FormError, localized, Screen, useWait, withNext } from "./shared";

/**
 * The code step of a sign-in with two-step verification (S31, AUTH-08). The sixth digit of the app's code sends it —
 * no button to look for; a wrong code is selected, so the next one replaces it. "Use a backup code" switches the field.
 * Opened without a sign-in in progress — or after it timed out — the screen says to sign in again, instead of a form
 * that fails with "Invalid two factor cookie".
 */
export function TwoFactorForm({ started }: { started: boolean }) {
  const t = useTranslations("auth");
  const tr = useTranslations();
  const locale = useLocale();
  const next = safeNext(useSearchParams().get("next"));
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(!started);
  const [wait, hold] = useWait();
  const input = useRef<HTMLInputElement>(null);
  const signIn = withNext("/auth/sign-in", next);

  if (expired)
    return (
      <Screen title={t("twoFactorRestartTitle")} about={t("twoFactorRestartText")}>
        <IntlLink href={signIn} className={buttonClass("primary", "lg", "w-full")}>
          {t("signInAgain")}
        </IntlLink>
      </Screen>
    );

  const verify = async (value: string) => {
    const c = value.trim();
    const found = !c ? t("codeMissing") : !backup && !/^\d{6}$/.test(c) ? t("codeSixDigits") : null;
    setError(found);
    if (found) return input.current?.focus();
    setBusy(true);
    const { key, wait } = await attempt((o) =>
      backup ? authClient.twoFactor.verifyBackupCode({ code: c }, o) : authClient.twoFactor.verifyTotp({ code: c, trustDevice: true }, o),
    );
    if (!key) {
      window.location.href = localized(locale, withNext("/profiles", next));
      return;
    }
    setBusy(false);
    if (key === "auth.errCodeExpired") return setExpired(true);
    if (wait) return hold(wait);
    // A backup code is gone once used, so a refused one may be a typo or one already spent: say both.
    setError(tr(backup && key === "auth.errCode" ? "auth.errBackupCode" : key));
    input.current?.select();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void verify(code);
  };

  return (
    <Screen title={t("twoFactorTitle")} about={backup ? t("backupCodeText") : t("twoFactorText")}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Field label={backup ? t("backupCode") : t("twoFactorAppCode")} error={error}>
          {(id, d, invalid) => (
            <Input
              key={backup ? "backup" : "app"}
              ref={input}
              id={id}
              aria-describedby={d}
              invalid={invalid}
              inputMode={backup ? "text" : "numeric"}
              autoComplete="one-time-code"
              autoCapitalize="none"
              // No maxLength for the app's code: a pasted "123 456" would lose its last digit before the spaces go.
              maxLength={backup ? 20 : undefined}
              size="lg"
              autoFocus
              spellCheck={false}
              value={code}
              onChange={(e) => {
                const value = backup ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(value);
                if (!backup && value.length === 6 && !busy && wait === 0) void verify(value);
              }}
              className="text-center text-h3 tabular-nums tracking-widest"
            />
          )}
        </Field>
        <FormError wait={wait} />
        <Button type="submit" className="mt-2 w-full" size="lg" loading={busy} disabled={wait > 0}>
          {t("verify")}
        </Button>
        <Button
          variant="tertiary"
          className="w-full"
          onClick={() => {
            setBackup(!backup);
            setCode("");
            setError(null);
          }}
        >
          {backup ? t("useAppCode") : t("useBackupCode")}
        </Button>
      </form>
      <p className="mt-6 text-center">
        <Link variant="action" href={signIn}>
          {t("backToSignIn")}
        </Link>
      </p>
    </Screen>
  );
}
