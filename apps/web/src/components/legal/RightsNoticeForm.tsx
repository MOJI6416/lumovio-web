"use client";

import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input, Textarea } from "@/components/ui/Input";
import { ApiRequestError, api } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The API's limits (admin/routes.ts, /api/rights-notice): checked here first, so the person sees them at the fields. */
const MAX_URLS = 50;

type Form = { name: string; email: string; organization: string; workDescription: string; urls: string; statement: string };
type Errors = Partial<Record<keyof Form | "form", string>>;

const urlsOf = (s: string) => s.split(/\s+/).filter(Boolean);
const isUrl = (s: string) => {
  try {
    const u = new URL(s);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
};

/**
 * Rights-holder notice (no account required): labels and checks in the page's language, errors at the fields
 * (never the server's "Bad Request"), the result named with the address the answer goes to. Stored for admin
 * review; rate limited server-side. In the English original of a translated page it keeps the page's language.
 */
export function RightsNoticeForm() {
  const t = useTranslations("legal");
  const tr = useTranslations();
  const locale = useLocale();
  const empty: Form = { name: "", email: "", organization: "", workDescription: "", urls: "", statement: "" };
  const [form, setForm] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const check = (f: Form): Errors => {
    const urls = urlsOf(f.urls);
    const bad = urls.find((u) => !isUrl(u));
    return {
      name: f.name.trim().length >= 2 ? undefined : t("errName"),
      email: !f.email.trim() ? tr("auth.emailMissing") : EMAIL.test(f.email.trim()) ? undefined : tr("auth.errInvalidEmail"),
      workDescription: f.workDescription.trim().length >= 10 ? undefined : t("errWork"),
      urls: !urls.length ? t("errUrls") : bad ? t("errUrl", { url: bad }) : urls.length > MAX_URLS ? t("errUrlsTooMany", { max: MAX_URLS }) : undefined,
      statement: f.statement.trim().length >= 10 ? undefined : t("errStatement"),
    };
  };

  /** A refusal the server explains field by field ("[urls.1] Invalid url") goes to those fields; anything else under the form. */
  const fromServer = (e: unknown): Errors => {
    if (e instanceof ApiRequestError && e.code === "bad_request" && e.issues?.length) {
      const found = check(form);
      const out: Errors = {};
      for (const issue of e.issues) {
        const [field, index] = issue.path.split(".") as [keyof Form, string | undefined];
        // "urls.1": the second address, named.
        const url = field === "urls" && index !== undefined ? urlsOf(form.urls)[Number(index)] : undefined;
        if (field in empty) out[field] = found[field] ?? (url ? t("errUrlRefused", { url }) : tr("auth.errInvalidInput"));
      }
      if (Object.keys(out).length) return out;
    }
    return { form: tr(apiErrorKey(e)) };
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = check(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setBusy(true);
    try {
      await api("/api/rights-notice", {
        method: "POST",
        json: {
          name: form.name.trim(),
          email: form.email.trim(),
          organization: form.organization.trim() || undefined,
          workDescription: form.workDescription.trim(),
          urls: urlsOf(form.urls),
          statement: form.statement.trim(),
        },
      });
      setSent(form.email.trim());
      setForm(empty);
    } catch (err) {
      setErrors(fromServer(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div lang={locale} className="mt-8">
        <InlineAlert
          tone="success"
          title={t("formSentTitle")}
          action={
            <Button variant="tertiary" size="sm" onClick={() => setSent(null)}>
              {t("formAnother")}
            </Button>
          }
        >
          {t("formSentText", { email: sent })}
        </InlineAlert>
      </div>
    );

  return (
    <form lang={locale} className="mt-8 space-y-4 rounded-md border border-line bg-surface-1 p-5" onSubmit={(e) => void submit(e)} noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("formName")} error={errors.name}>
          {(id, d, invalid) => <Input id={id} aria-describedby={d} invalid={invalid} autoComplete="name" maxLength={120} value={form.name} onChange={set("name")} />}
        </Field>
        <Field label={t("formEmail")} error={errors.email}>
          {(id, d, invalid) => (
            <Input id={id} aria-describedby={d} invalid={invalid} type="email" autoComplete="email" maxLength={200} value={form.email} onChange={set("email")} />
          )}
        </Field>
      </div>
      <Field label={t("formOrganization")} error={errors.organization}>
        {(id, d, invalid) => <Input id={id} aria-describedby={d} invalid={invalid} autoComplete="organization" maxLength={200} value={form.organization} onChange={set("organization")} />}
      </Field>
      <Field label={t("formWork")} hint={t("formWorkHint")} error={errors.workDescription}>
        {(id, d, invalid) => <Textarea id={id} aria-describedby={d} invalid={invalid} maxLength={4000} rows={4} value={form.workDescription} onChange={set("workDescription")} />}
      </Field>
      <Field label={t("formUrls")} hint={t("formUrlsHint")} error={errors.urls}>
        {(id, d, invalid) => <Textarea id={id} aria-describedby={d} invalid={invalid} rows={3} value={form.urls} onChange={set("urls")} />}
      </Field>
      <Field label={t("formStatement")} hint={t("formStatementHint")} error={errors.statement}>
        {(id, d, invalid) => <Textarea id={id} aria-describedby={d} invalid={invalid} maxLength={2000} rows={3} value={form.statement} onChange={set("statement")} />}
      </Field>
      {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
      <Button type="submit" loading={busy}>
        {t("formSend")}
      </Button>
    </form>
  );
}
