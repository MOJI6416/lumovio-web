"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { authCall } from "@/components/auth/auth-call";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input, PasswordInput } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { authErrorKey } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";
import { groupKey, totpSecret } from "@/lib/totp-key";
import { useDiscardGuard } from "./use-unsaved";

const MIN_PASSWORD = 10;

/**
 * "Change password" (S17, design-system 8.8): a form in a dialog with an explicit "Change password", checked on submit,
 * errors at the fields; closing it with something typed asks first. Loaded when it is opened (SecuritySettings).
 */
export function PasswordDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<{ cur?: string; next?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const close = useDiscardGuard(cur.length > 0 || next.length > 0, onClose);

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
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && void close()} title={t("changePassword")} description={t("changePasswordHint")} size="sm">
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
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
        <DialogActions className="mt-2">
          <Button variant="secondary" disabled={busy} onClick={() => void close()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {t("savePassword")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

type Setup = { qr: string; uri: string; key: string; backup: string[] };

/**
 * Two-step verification in a dialog (S17). Turning it on: the steps are said first (password → scan the QR code → type a
 * code → keep the backup codes), then it asks for the password; beside the QR code its setup key as text with "Copy",
 * for an authenticator on the same phone. Turning it off asks for the password. Leaving the QR step asks first: the setup
 * isn't finished. The backup codes are shown once, until "I've saved the codes".
 */
export function TwoFactorDialog({ enabled, onClose, onChanged }: { enabled: boolean; onClose: () => void; onChanged: (on: boolean) => void }) {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState<"password" | "scan" | "codes">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = useDiscardGuard(step === "scan" || password.length > 0, onClose);

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
    setStep("scan");
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
    onChanged(true);
    setStep("codes");
    // The row behind follows at once; the codes stay on screen until "I've saved the codes".
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
    onChanged(false);
    router.refresh();
    onClose();
  };

  const steps = [t("twoFactorStep1"), t("twoFactorStep2"), t("twoFactorStep3"), t("twoFactorStep4")];
  const passwordField = (
    <Field label={t("currentPassword")} error={error}>
      {(id, d, invalid) => (
        <PasswordInput id={id} aria-describedby={d} invalid={invalid} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      )}
    </Field>
  );

  if (enabled && step === "password")
    return (
      <Dialog open onOpenChange={(o) => !o && void close()} title={t("disable2faTitle")} description={t("disable2faText")} size="sm">
        <form onSubmit={(e) => void disable(e)} noValidate className="flex flex-col gap-4">
          {passwordField}
          <DialogActions className="mt-2">
            <Button variant="secondary" disabled={busy} onClick={() => void close()}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              {t("disable2fa")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    );

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && (step === "codes" ? onClose() : void close())}
      title={t("twoFactor")}
      description={step === "password" ? undefined : t("twoFactorStepOf", { n: step === "scan" ? 2 : 4, total: 4 })}
      size={step === "scan" ? "lg" : "sm"}
    >
      {step === "password" && (
        <form onSubmit={(e) => void start(e)} noValidate className="flex flex-col gap-4">
          {/* What it is, for a screen reader (1.2, principle 6); the steps are the instruction everyone sees. */}
          <p className="sr-only">{t("twoFactorIntro")}</p>
          <ol className="flex list-decimal flex-col gap-1 ps-5 text-body text-text-2">
            {steps.map((s, i) => (
              <li key={s} className={i === 0 ? "font-semibold text-text-1" : undefined}>
                {s}
              </li>
            ))}
          </ol>
          {passwordField}
          <DialogActions className="mt-2">
            <Button variant="secondary" disabled={busy} onClick={() => void close()}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {tc("next")}
            </Button>
          </DialogActions>
        </form>
      )}

      {step === "scan" && setup && (
        <div className="grid gap-6 md:grid-cols-[13.75rem_1fr]">
          {/* A QR code keeps its white quiet zone in both themes (3.6). */}
          {/* biome-ignore lint/performance/noImgElement: a data: URL drawn here, nothing for the image optimiser */}
          <img src={setup.qr} alt={t("qrAlt")} className="rounded-md bg-white p-2" width={220} height={220} />
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-body text-text-2">{t("scanQr")}</p>
            {/* The phone that holds the authenticator can't scan its own screen: the same key as text, with Copy. */}
            {setup.key && (
              <div className="flex flex-col gap-2">
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
            <form onSubmit={(e) => void verify(e)} noValidate className="flex flex-col gap-4">
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
                    className="max-w-48 text-center tabular-nums tracking-widest"
                  />
                )}
              </Field>
              <DialogActions className="mt-0">
                <Button variant="secondary" disabled={busy} onClick={() => void close()}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" loading={busy}>
                  {ta("verify")}
                </Button>
              </DialogActions>
            </form>
          </div>
        </div>
      )}

      {step === "codes" && setup && (
        <div className="flex flex-col gap-4">
          <InlineAlert tone="success" title={t("twoFactorEnabled")}>
            {t("backupCodesHint")}
          </InlineAlert>
          <p className="text-body font-semibold text-text-1">{t("backupCodes")}</p>
          <ul className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-3 text-body tabular-nums [font-variant-ligatures:none]">
            {setup.backup.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <DialogActions className="mt-2">
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
            <Button onClick={onClose}>{t("backupCodesSaved")}</Button>
          </DialogActions>
        </div>
      )}
    </Dialog>
  );
}
