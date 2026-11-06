"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { authCall } from "@/components/auth/auth-call";
import { useSession } from "@/components/providers/Providers";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input, PasswordInput } from "@/components/ui/Input";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { authErrorKey } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";
import { groupKey, totpSecret } from "@/lib/totp-key";
import { useUnsavedChanges } from "./use-unsaved";

const MIN_PASSWORD = 10;

/**
 * Settings → Security (S17, audit SET-07): the password and two-step verification together. Changing the password is
 * a form with an explicit "Save" (8.8), errors at the fields; two-step verification explains its steps before it
 * asks for the password.
 */
export function SecuritySettings() {
  const { me } = useSession();
  if (!me) return null;
  const hasPassword = me.linkedProviders.includes("credential");
  return (
    <div className="space-y-6">
      <PasswordSection hasPassword={hasPassword} />
      <TwoFactorSection enabled={me.user.twoFactorEnabled} hasPassword={hasPassword} />
    </div>
  );
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<{ cur?: string; next?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  useUnsavedChanges(cur.length > 0 || next.length > 0);

  if (!hasPassword) {
    return (
      <SettingsSection title={t("passwordSection")}>
        <SettingsRow label={t("noPassword")} description={t("noPasswordHint")}>
          {null}
        </SettingsRow>
      </SettingsSection>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Checked on submit, said at the field (one model for every form, AUTH-04).
    const found = {
      cur: cur ? undefined : t("currentPasswordMissing"),
      next: next.length >= MIN_PASSWORD ? undefined : ta("errPasswordShort"),
    };
    setErrors(found);
    if (found.cur || found.next) return;
    setBusy(true);
    const r = await authCall(() => authClient.changePassword({ currentPassword: cur, newPassword: next, revokeOtherSessions: true }));
    setBusy(false);
    if (r.error) {
      const key = authErrorKey(r.error);
      if (key === "auth.errWrongPassword" || key === "auth.invalidCredentials") setErrors({ cur: ta("errWrongPassword") });
      else if (key.startsWith("auth.errPassword")) setErrors({ next: tr(key) });
      else setErrors({ form: tr(key) });
      return;
    }
    toast.success(t("passwordChanged"));
    setCur("");
    setNext("");
  };

  return (
    <SettingsSection title={t("passwordSection")} description={t("changePasswordHint")}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4 py-4 md:max-w-md">
        <Field label={t("currentPassword")} error={errors.cur}>
          {(id, d, invalid) => (
            <PasswordInput id={id} aria-describedby={d} invalid={invalid} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
          )}
        </Field>
        <Field label={ta("newPassword")} hint={ta("passwordHint")} error={errors.next}>
          {(id, d, invalid) => (
            <PasswordInput id={id} aria-describedby={d} invalid={invalid} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          )}
        </Field>
        {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
        <div className="flex flex-wrap gap-2">
          {/* Off until something is typed (8.8). */}
          <Button type="submit" loading={busy} disabled={!cur && !next}>
            {t("savePassword")}
          </Button>
          {(cur || next) && (
            <Button
              variant="tertiary"
              disabled={busy}
              onClick={() => {
                setCur("");
                setNext("");
                setErrors({});
              }}
            >
              {tc("cancel")}
            </Button>
          )}
        </div>
      </form>
    </SettingsSection>
  );
}

type Setup = { qr: string; uri: string; key: string; backup: string[] };

/**
 * Two-step verification: the steps are said first (password → scan the QR code → type a code → keep the backup
 * codes), then it asks for the password. Beside the QR code, its setup key as text with "Copy", for an authenticator on
 * the same phone. Turning it off asks for the password at the place of the button.
 */
function TwoFactorSection({ enabled, hasPassword }: { enabled: boolean; hasPassword: boolean }) {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "password" | "scan" | "codes" | "disable">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // What this form just did, until the session says the same: the status at the top follows at once (it said "Off"
  // beside "Two-step verification is on" while the backup codes were shown).
  const [changed, setChanged] = useState<boolean | null>(null);
  const [seen, setSeen] = useState(enabled);
  if (seen !== enabled) {
    setSeen(enabled);
    setChanged(null);
  }
  const on = changed ?? enabled;
  useUnsavedChanges(mode === "scan");

  const reset = () => {
    setMode("idle");
    setPassword("");
    setCode("");
    setSetup(null);
    setError(null);
  };

  const start = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError(t("currentPasswordMissing"));
    setBusy(true);
    setError(null);
    const r = await authCall(() => authClient.twoFactor.enable({ password }));
    if (r.error || !r.data || !("totpURI" in r.data)) {
      setBusy(false);
      const key = authErrorKey(r.error);
      setError(key === "auth.invalidCredentials" ? ta("errWrongPassword") : tr(key));
      return;
    }
    // The QR encoder loads only here, when protection is being turned on (bundle budget).
    const { toDataURL } = await import("qrcode");
    const uri = r.data.totpURI;
    setSetup({ qr: await toDataURL(uri, { margin: 1, width: 220 }), uri, key: totpSecret(uri), backup: r.data.backupCodes });
    setBusy(false);
    setPassword("");
    setMode("scan");
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError(t("codeFormat"));
    setBusy(true);
    setError(null);
    const r = await authCall(() => authClient.twoFactor.verifyTotp({ code }));
    setBusy(false);
    if (r.error) return setError(tr(authErrorKey(r.error)));
    setCode("");
    setChanged(true);
    setMode("codes");
    // The status at the top follows at once; the codes stay on screen until "I've saved the codes".
    router.refresh();
  };

  const disable = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError(t("currentPasswordMissing"));
    setBusy(true);
    setError(null);
    const r = await authCall(() => authClient.twoFactor.disable({ password }));
    setBusy(false);
    if (r.error) {
      const key = authErrorKey(r.error);
      return setError(key === "auth.invalidCredentials" ? ta("errWrongPassword") : tr(key));
    }
    toast.success(t("twoFactorDisabled"));
    setChanged(false);
    reset();
    router.refresh();
  };

  const steps = [t("twoFactorStep1"), t("twoFactorStep2"), t("twoFactorStep3"), t("twoFactorStep4")];
  const status = on ? (
    <StatusBadge status="success">{t("twoFactorOn")}</StatusBadge>
  ) : (
    <StatusBadge status="neutral">{t("twoFactorOff")}</StatusBadge>
  );

  return (
    <SettingsSection title={t("twoFactor")} description={t("twoFactorIntro")}>
      <SettingsRow label={t("twoFactorState")} description={!hasPassword ? t("twoFactorNeedsPassword") : undefined}>
        {status}
        {hasPassword && mode === "idle" && !on && (
          <Button variant="secondary" icon={ShieldCheck} onClick={() => setMode("password")}>
            {t("enable2fa")}
          </Button>
        )}
        {/* Turning protection off is the risky way: red words, not a filled button (7.1). */}
        {hasPassword && mode === "idle" && on && (
          <Button variant="danger-tertiary" onClick={() => setMode("disable")}>
            {t("disable2fa")}
          </Button>
        )}
      </SettingsRow>

      {mode === "password" && (
        <div className="flex flex-col gap-4 py-4">
          <ol className="flex list-decimal flex-col gap-1 ps-5 text-body text-text-2">
            {steps.map((s, i) => (
              <li key={s} className={i === 0 ? "font-semibold text-text-1" : undefined}>
                {s}
              </li>
            ))}
          </ol>
          <form onSubmit={(e) => void start(e)} noValidate className="flex flex-col gap-4 md:max-w-md">
            <Field label={t("currentPassword")} error={error}>
              {(id, d, invalid) => (
                <PasswordInput id={id} aria-describedby={d} invalid={invalid} autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={busy}>
                {tc("next")}
              </Button>
              <Button variant="tertiary" disabled={busy} onClick={reset}>
                {tc("cancel")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {mode === "scan" && setup && (
        <div className="grid gap-6 py-4 md:grid-cols-[13.75rem_1fr]">
          {/* A QR code keeps its white quiet zone in both themes (3.6). */}
          <img src={setup.qr} alt={t("qrAlt")} className="rounded-md bg-white p-2" width={220} height={220} />
          <div className="flex flex-col gap-4">
            <p className="text-body font-semibold text-text-1">{t("twoFactorStepOf", { n: 2, total: 4 })}</p>
            <p className="text-body text-text-2">{t("scanQr")}</p>
            {/* The phone that holds the authenticator can't scan its own screen: the same key as text, with Copy. */}
            {setup.key && (
              <div className="flex flex-col gap-2 md:max-w-xl">
                <p className="text-body-s font-semibold text-text-1">{t("setupKey")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 select-all break-words rounded-md bg-surface-2 px-3 py-2 text-body tabular-nums tracking-wide text-text-1 [font-variant-ligatures:none]">
                    {groupKey(setup.key)}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void navigator.clipboard.writeText(setup.key).then(
                        () => toast.success(t("setupKeyCopied")),
                        () => toast.error(t("setupKeyCopyFailed")),
                      )
                    }
                  >
                    {tc("copy")}
                  </Button>
                </div>
                <p className="text-caption font-medium text-text-3">{t("setupKeyHint")}</p>
              </div>
            )}
            <form onSubmit={(e) => void verify(e)} noValidate className="flex flex-col gap-4 md:max-w-xs">
              <Field label={ta("twoFactorAppCode")} error={error}>
                {(id, d, invalid) => (
                  <Input
                    id={id}
                    aria-describedby={d}
                    invalid={invalid}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center tabular-nums tracking-widest"
                  />
                )}
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={busy}>
                  {ta("verify")}
                </Button>
                <Button variant="tertiary" disabled={busy} onClick={reset}>
                  {tc("cancel")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mode === "codes" && setup && (
        <div className="flex flex-col gap-4 py-4">
          <InlineAlert tone="success" title={t("twoFactorEnabled")}>
            {t("backupCodesHint")}
          </InlineAlert>
          <p className="text-body font-semibold text-text-1">{t("backupCodes")}</p>
          <ul className="grid max-w-md grid-cols-2 gap-1 rounded-md bg-surface-2 p-3 text-body tabular-nums [font-variant-ligatures:none]">
            {setup.backup.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                reset();
                router.refresh();
              }}
            >
              {t("backupCodesSaved")}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void navigator.clipboard.writeText(setup.backup.join("\n")).then(
                  () => toast.success(tc("copied")),
                  () => toast.error(t("copyFailed")),
                )
              }
            >
              {t("copyCodes")}
            </Button>
          </div>
        </div>
      )}

      {mode === "disable" && (
        <form onSubmit={(e) => void disable(e)} noValidate className="flex flex-col gap-4 py-4 md:max-w-md">
          <p className="text-body text-text-2">{t("disable2faText")}</p>
          <Field label={t("currentPassword")} error={error}>
            {(id, d, invalid) => (
              <PasswordInput id={id} aria-describedby={d} invalid={invalid} autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger-tertiary" loading={busy}>
              {t("disable2fa")}
            </Button>
            <Button variant="tertiary" disabled={busy} onClick={reset}>
              {tc("cancel")}
            </Button>
          </div>
        </form>
      )}
    </SettingsSection>
  );
}
