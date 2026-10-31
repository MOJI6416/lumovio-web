"use client";

import { KeyRound, Link2Off, type LucideIcon, MailCheck, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input, PasswordInput } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { Link as IntlLink } from "@/i18n/navigation";
import { authErrorKey } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { authCall } from "./auth-call";
import { useAuthCaptcha } from "./captcha";
import { usePlatform } from "@/lib/platform";
import { type SocialProvider, SocialButtons } from "./SocialButtons";

export { safeNext };

const MIN_PASSWORD = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// How long "Send again" waits after a letter went out (AUTH-09).
const RESEND_AFTER = 60;
const SENT_KEY = "lumovio:signup-sent";

function localized(locale: string, path: string) {
  return locale === "en" ? path : `/${locale}${path}`;
}
/** `?next=…` for links between the sign-in pages, so the way back survives every step (AUTH-06). */
const withNext = (path: string, next: string) => (next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`);

/**
 * The card's content of the Focus template (design-system 9): an optional icon, the page's h1, one line of text, then
 * the form or the actions. One model of checking for every form (AUTH-04): the button is always on, Enter sends, the
 * check runs on submit and each error is said at its field (Field `error`), what isn't about one field under the form.
 */
function Card({ icon: Icon, title, subtitle, children }: { icon?: LucideIcon; title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="animate-fade-up">
      {Icon && (
        <div className="mb-5 grid size-12 place-items-center rounded-full bg-surface-2 text-text-2">
          <Icon aria-hidden className="size-6" />
        </div>
      )}
      <h1 className="text-balance text-h2 text-text-1">{title}</h1>
      {subtitle && <p className="mt-2 text-body text-text-2">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** The field an auth error is about: said there instead of under the form. */
function fieldOf(key: string): "email" | "password" | null {
  if (key === "auth.errInvalidEmail" || key === "auth.errUserExists") return "email";
  if (key.startsWith("auth.errPassword")) return "password";
  return null;
}

type Errors = { email?: string; password?: string; name?: string; form?: string };

function useEmailChecks() {
  const t = useTranslations("auth");
  return (email: string) => (!email.trim() ? t("emailMissing") : !EMAIL.test(email.trim()) ? t("errInvalidEmail") : undefined);
}

/** Seconds left before "Send again" works; `start()` after each letter. */
function useCooldown(from: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (from === null) return;
    const tick = () => setLeft(Math.max(0, Math.ceil(RESEND_AFTER - (Date.now() - from) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [from]);
  return left;
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function SignInForm({ providers }: { providers?: SocialProvider[] | null }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const checkEmail = useEmailChecks();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const captcha = useAuthCaptcha();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = { email: checkEmail(email), password: password ? undefined : t("passwordMissing") };
    if (!found.email && !found.password && captcha.missing) found.form = tr("support.errCaptcha");
    setErrors(found);
    if (found.email || found.password || found.form) return;
    setBusy(true);
    const res = await authCall(() =>
      authClient.signIn.email({ email: email.trim(), password, callbackURL: localized(locale, next) }, { headers: captcha.headers() }),
    );
    captcha.spent();
    if (res.error) {
      const key = authErrorKey(res.error);
      const field = fieldOf(key);
      setErrors(field ? { [field]: tr(key) } : { form: tr(key) });
      setBusy(false);
      return;
    }
    if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) return; // the plugin goes to the code step
    // Who's watching first, then back where the person came from (AUTH-06).
    window.location.href = localized(locale, withNext("/profiles", next));
  };

  return (
    <Card title={t("signInTitle")} subtitle={t("signInSubtitle")}>
      <SocialButtons next={localized(locale, withNext("/profiles", next))} providers={providers} />
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        <Field label={t("email")} error={errors.email}>
          {(id, d, invalid) => <Input id={id} aria-describedby={d} invalid={invalid} type="email" autoComplete="email" size="lg" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label={t("password")} error={errors.password}>
          {(id, d, invalid) => <PasswordInput id={id} aria-describedby={d} invalid={invalid} autoComplete="current-password" size="lg" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <div>
          <Link variant="action" href={withNext("/auth/forgot", next)}>
            {t("forgot")}
          </Link>
        </div>
        {captcha.widget}
        {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          {tc("signIn")}
        </Button>
      </form>
      {/* Creating an account is a button of its own for someone who comes for the first time (AUTH-11). */}
      <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6">
        <p className="text-center text-body-s text-text-2">{t("noAccount")}</p>
        <IntlLink href={withNext("/auth/sign-up", next)} className={buttonClass("secondary", "lg", "w-full")}>
          {tc("signUp")}
        </IntlLink>
      </div>
    </Card>
  );
}

type Sent = { email: string; at: number; next: string };

function readSent(): Sent | null {
  try {
    const raw = sessionStorage.getItem(SENT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Sent;
    return Date.now() - s.at < 24 * 3600_000 ? s : null;
  } catch {
    return null;
  }
}
function writeSent(s: Sent | null) {
  try {
    if (s) sessionStorage.setItem(SENT_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SENT_KEY);
  } catch {
    // Without storage the "Check your email" step only doesn't survive a reload.
  }
}

export function SignUpForm({ providers }: { providers?: SocialProvider[] | null }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const checkEmail = useEmailChecks();
  const platform = usePlatform();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState<Sent | null>(null);
  const captcha = useAuthCaptcha();
  // "Check your email" survives a reload of the page in this tab (AUTH-09).
  useEffect(() => setSent(readSent()), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Errors = {
      email: checkEmail(email),
      password: password.length >= MIN_PASSWORD ? undefined : password ? t("errPasswordShort") : t("passwordMissing"),
    };
    if (!found.email && !found.password && captcha.missing) found.form = tr("support.errCaptcha");
    setErrors(found);
    if (found.email || found.password || found.form) return;
    setBusy(true);
    const address = email.trim();
    const res = await authCall(() =>
      authClient.signUp.email(
        { email: address, password, name: name.trim() || address.split("@")[0]!, callbackURL: localized(locale, withNext("/profiles", next)) },
        { headers: { "x-lumovio-locale": locale, ...captcha.headers() } },
      ),
    );
    captcha.spent();
    setBusy(false);
    if (res.error) {
      const key = authErrorKey(res.error);
      const field = fieldOf(key);
      setErrors(field ? { [field]: tr(key) } : { form: tr(key) });
      return;
    }
    if (res.data?.token) {
      window.location.href = localized(locale, withNext("/profiles", next));
      return;
    }
    const s = { email: address, at: Date.now(), next };
    writeSent(s);
    setPassword("");
    setSent(s);
  };

  if (sent)
    return (
      <CheckEmail
        sent={sent}
        onResent={(at) => {
          const s = { ...sent, at };
          writeSent(s);
          setSent(s);
        }}
        onChangeEmail={() => {
          setEmail(sent.email);
          writeSent(null);
          setSent(null);
        }}
      />
    );

  // Registration closed by the owner (Admin → Management → Settings): said before anyone fills the form.
  if (platform.data?.registration === "closed")
    return (
      <Card title={t("signUpTitle")}>
        <InlineAlert tone="info" title={t("registrationClosedTitle")}>
          {t("registrationClosedText")}
        </InlineAlert>
        <IntlLink href={withNext("/auth/sign-in", next)} className={buttonClass("primary", "lg", "w-full")}>
          {tc("signIn")}
        </IntlLink>
      </Card>
    );

  return (
    <Card title={t("signUpTitle")} subtitle={t("signUpSubtitle")}>
      <SocialButtons next={localized(locale, withNext("/profiles", next))} providers={providers} />
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
        <Field label={`${t("name")} (${tc("optional")})`}>
          {(id) => <Input id={id} autoComplete="name" size="lg" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={t("email")} error={errors.email}>
          {(id, d, invalid) => <Input id={id} aria-describedby={d} invalid={invalid} type="email" autoComplete="email" size="lg" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label={t("password")} hint={t("passwordHint")} error={errors.password}>
          {(id, d, invalid) => (
            <PasswordInput id={id} aria-describedby={d} invalid={invalid} autoComplete="new-password" size="lg" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        {captcha.widget}
        {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          {tc("signUp")}
        </Button>
        <p className="text-center text-body-s text-text-2">
          {t.rich("terms", {
            terms: (c) => <Link href="/legal/terms">{c}</Link>,
            privacy: (c) => <Link href="/legal/privacy">{c}</Link>,
          })}
        </p>
      </form>
      <p className="mt-6 text-center text-body-s text-text-2">
        {t("haveAccount")}{" "}
        <Link variant="action" href={withNext("/auth/sign-in", next)}>
          {tc("signIn")}
        </Link>
      </p>
    </Card>
  );
}

/** "Check your email" (AUTH-09): the address, "Send again" after a minute, "Change the address" and the way back. */
function CheckEmail({ sent, onResent, onChangeEmail }: { sent: Sent; onResent: (at: number) => void; onChangeEmail: () => void }) {
  const t = useTranslations("auth");
  const tr = useTranslations();
  const locale = useLocale();
  const left = useCooldown(sent.at);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const resend = async () => {
    setBusy(true);
    setError(null);
    const res = await authCall(() => authClient.sendVerificationEmail({ email: sent.email, callbackURL: localized(locale, withNext("/profiles", sent.next)) }));
    setBusy(false);
    if (res.error) return setError(tr(authErrorKey(res.error)));
    setResent(true);
    onResent(Date.now());
  };
  return (
    <Card icon={MailCheck} title={t("checkEmailTitle")} subtitle={t("checkEmailText", { email: sent.email })}>
      <div className="flex flex-col gap-3">
        {resent && (
          <InlineAlert tone="success" className="mb-1">
            {t("resent")}
          </InlineAlert>
        )}
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <Button variant="secondary" size="lg" className="w-full tabular-nums" loading={busy} disabled={left > 0} onClick={() => void resend()}>
          {left > 0 ? t("resendIn", { time: clock(left) }) : t("resend")}
        </Button>
        <Button variant="tertiary" className="w-full" onClick={onChangeEmail}>
          {t("changeEmail")}
        </Button>
        <p className="mt-2 text-center text-body-s">
          <Link variant="action" href={withNext("/auth/sign-in", sent.next)}>
            {t("backToSignIn")}
          </Link>
        </p>
      </div>
    </Card>
  );
}

export function ForgotForm() {
  const t = useTranslations("auth");
  const tr = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const checkEmail = useEmailChecks();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const left = useCooldown(sentAt);
  const captcha = useAuthCaptcha();
  const send = async () => {
    if (captcha.missing) return setErrors({ form: tr("support.errCaptcha") });
    setBusy(true);
    setErrors({});
    // Same response whether or not the account exists (no account enumeration); a refused or lost
    // request (bad address, too many requests, offline) says so instead of pretending it was sent.
    const res = await authCall(() =>
      authClient.requestPasswordReset({ email: email.trim(), redirectTo: localized(locale, "/auth/reset") }, { headers: captcha.headers() }),
    );
    captcha.spent();
    setBusy(false);
    if (res.error) {
      const key = authErrorKey(res.error);
      setErrors(fieldOf(key) === "email" ? { email: tr(key) } : { form: tr(key) });
    } else setSentAt(Date.now());
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = checkEmail(email);
    setErrors({ email: found });
    if (!found) void send();
  };
  return (
    <Card icon={sentAt ? MailCheck : KeyRound} title={sentAt ? t("checkEmailTitle") : t("forgotTitle")} subtitle={sentAt ? t("forgotSentText", { email: email.trim() }) : t("forgotText")}>
      {sentAt ? (
        <div className="flex flex-col gap-3">
          {/* "Send again" is a reset request too: it needs its own check. */}
          {captcha.widget}
          {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
          <Button variant="secondary" size="lg" className="w-full tabular-nums" loading={busy} disabled={left > 0} onClick={() => void send()}>
            {left > 0 ? t("resendIn", { time: clock(left) }) : t("resend")}
          </Button>
          <Button variant="tertiary" className="w-full" onClick={() => setSentAt(null)}>
            {t("changeEmail")}
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <Field label={t("email")} error={errors.email}>
            {(id, d, invalid) => (
              <Input id={id} aria-describedby={d} invalid={invalid} type="email" autoComplete="email" size="lg" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          {captcha.widget}
          {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            {t("sendLink")}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-body-s">
        <Link variant="action" href={withNext("/auth/sign-in", next)}>
          {t("backToSignIn")}
        </Link>
      </p>
    </Card>
  );
}

/**
 * A new password from the e-mailed link (AUTH-05): without a token, with an expired one (`?error=INVALID_TOKEN` from
 * the link) or one refused on save, the page says the link doesn't work and offers a new one — not a form that fails
 * after the password is typed.
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
  const [state, setState] = useState<"form" | "invalid" | "done">(!token || params.get("error") ? "invalid" : "form");

  if (state === "invalid")
    return (
      <Card icon={Link2Off} title={t("resetInvalidTitle")} subtitle={t("resetInvalidText")}>
        <div className="flex flex-col gap-3">
          <IntlLink href="/auth/forgot" className={buttonClass("primary", "lg", "w-full")}>
            {t("sendNewLink")}
          </IntlLink>
          <IntlLink href="/auth/sign-in" className={buttonClass("tertiary", "lg", "w-full")}>
            {t("backToSignIn")}
          </IntlLink>
        </div>
      </Card>
    );
  if (state === "done")
    return (
      <Card icon={ShieldCheck} title={t("resetDoneTitle")} subtitle={t("resetDoneText")}>
        <IntlLink href="/auth/sign-in" className={buttonClass("primary", "lg", "w-full")}>
          {tc("signIn")}
        </IntlLink>
      </Card>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = password.length >= MIN_PASSWORD ? undefined : password ? t("errPasswordShort") : t("passwordMissing");
    setErrors({ password: found });
    if (found) return;
    setBusy(true);
    const res = await authCall(() => authClient.resetPassword({ newPassword: password, token }));
    setBusy(false);
    if (!res.error) return setState("done");
    const key = authErrorKey(res.error);
    if (key === "auth.errLinkExpired") return setState("invalid");
    setErrors(fieldOf(key) === "password" ? { password: tr(key) } : { form: tr(key) });
  };
  return (
    <Card title={t("resetTitle")} subtitle={t("resetText")}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <Field label={t("newPassword")} hint={t("passwordHint")} error={errors.password}>
          {(id, d, invalid) => (
            <PasswordInput id={id} aria-describedby={d} invalid={invalid} autoComplete="new-password" size="lg" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          {t("savePassword")}
        </Button>
      </form>
    </Card>
  );
}

/**
 * The code step of a sign-in with two-step verification (AUTH-08). Opened without a sign-in in progress — or after it
 * timed out — it says to sign in again with a link, instead of a form that fails with "Invalid two factor cookie".
 */
export function TwoFactorForm({ started }: { started: boolean }) {
  const t = useTranslations("auth");
  const tr = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(!started);

  if (expired)
    return (
      <Card icon={ShieldCheck} title={t("twoFactorRestartTitle")} subtitle={t("twoFactorRestartText")}>
        <IntlLink href={withNext("/auth/sign-in", next)} className={buttonClass("primary", "lg", "w-full")}>
          {t("signInAgain")}
        </IntlLink>
      </Card>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    const found = !c ? t("codeMissing") : !backup && !/^\d{6}$/.test(c) ? t("codeSixDigits") : null;
    setError(found);
    if (found) return;
    setBusy(true);
    const res = await authCall(() => (backup ? authClient.twoFactor.verifyBackupCode({ code: c }) : authClient.twoFactor.verifyTotp({ code: c, trustDevice: true })));
    if (!res.error) {
      window.location.href = localized(locale, withNext("/profiles", next));
      return;
    }
    setBusy(false);
    const key = authErrorKey(res.error);
    if (key === "auth.errCodeExpired") return setExpired(true);
    setError(tr(key));
  };
  return (
    <Card icon={ShieldCheck} title={t("twoFactorTitle")} subtitle={backup ? t("backupCodeText") : t("twoFactorText")}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <Field label={backup ? t("backupCode") : t("twoFactorAppCode")} error={error}>
          {(id, d, invalid) => (
            <Input
              key={backup ? "backup" : "app"}
              id={id}
              aria-describedby={d}
              invalid={invalid}
              inputMode={backup ? "text" : "numeric"}
              autoComplete="one-time-code"
              maxLength={backup ? 20 : 6}
              size="lg"
              autoFocus
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(backup ? e.target.value : e.target.value.replace(/\D/g, ""))}
              className="text-center text-h3 tabular-nums tracking-widest"
            />
          )}
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={busy}>
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
      <p className="mt-6 text-center text-body-s">
        <Link variant="action" href={withNext("/auth/sign-in", next)}>
          {t("backToSignIn")}
        </Link>
      </p>
    </Card>
  );
}
