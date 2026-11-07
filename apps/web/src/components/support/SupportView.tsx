"use client";

import type { AuthCapabilities } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { type Status, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input, Textarea } from "@/components/ui/Input";
import { QueryState } from "@/components/ui/QueryState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiRequestError, api } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { relativeTime } from "@/lib/format";
import { lastPlayback } from "@/lib/last-playback";
import { isTvMode } from "@/lib/tv";
import { Turnstile } from "./Turnstile";

export const TOPICS = ["playback", "account", "bug", "idea"] as const;
type Topic = (typeof TOPICS)[number];

/** The person's view of a request's status. */
export const STATUS_TONE: Record<string, Status> = { new: "neutral", in_progress: "warning", waiting: "success", closed: "neutral" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface MyRequest {
  id: string;
  topic: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  last: { author: string; text: string } | null;
}

/** What the technical summary sends, read when the form is sent (and shown before). */
function summary() {
  const installed = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const pb = lastPlayback();
  return {
    userAgent: navigator.userAgent.slice(0, 400),
    language: navigator.language?.slice(0, 40),
    screen: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}`.slice(0, 40),
    installed,
    tvMode: isTvMode(document.cookie, navigator.userAgent),
    page: window.location.pathname.slice(0, 200),
    playback: pb ? { at: pb.at, provider: pb.provider, method: pb.method, outcome: pb.outcome, errorCode: pb.errorCode, platform: pb.platform } : null,
  };
}

/**
 * Support (admin handoff «Поддержка»): the form — a topic, the message, for a guest the e-mail for the answer and the
 * bot check, and by the person's tick the technical summary, shown before it goes — and, signed in, «Мои обращения».
 */
export function SupportView({ email }: { email: string | null }) {
  const t = useTranslations("support");
  const tr = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const guest = !email;
  const caps = useQuery({ queryKey: ["auth-capabilities"], queryFn: () => api<AuthCapabilities>("/api/auth-capabilities"), enabled: guest });
  const mine = useQuery({ queryKey: ["support"], queryFn: () => api<{ requests: MyRequest[] }>("/api/support"), enabled: !guest });
  const [topic, setTopic] = useState<Topic | undefined>(undefined);
  const [text, setText] = useState("");
  const [address, setAddress] = useState("");
  const [attach, setAttach] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<"topic" | "text" | "email" | "captcha" | "form", string>>>({});
  const siteKey = guest ? (caps.data?.turnstileSiteKey ?? null) : null;
  /** A field's error goes as soon as the field is changed. */
  const fix = (k: "topic" | "text" | "email") => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = {
      topic: topic ? undefined : t("errTopic"),
      text: text.trim().length >= 10 ? undefined : t("errMessage"),
      email: !guest ? undefined : !address.trim() ? tr("auth.emailMissing") : EMAIL.test(address.trim()) ? undefined : tr("auth.errInvalidEmail"),
      captcha: siteKey && !captcha ? t("errCaptcha") : undefined,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setBusy(true);
    try {
      const r = await api<{ id: string | null }>("/api/support", {
        method: "POST",
        json: { topic, text: text.trim(), email: guest ? address.trim() : undefined, diagnostics: attach ? summary() : null, captcha: captcha ?? undefined, website: website || undefined },
      });
      if (!guest && r.id) {
        router.push(`/support/${r.id}`);
        return;
      }
      setSent(address.trim());
      setTopic(undefined);
      setText("");
      setAttach(false);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "bad_request" && err.issues?.some((i) => i.path === "captcha")) setErrors({ captcha: t("errCaptcha") });
      else if (err instanceof ApiRequestError && err.code === "conflict") setErrors({ form: t("errTooMany") });
      else setErrors({ form: tr(apiErrorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  const s = showSummary ? summary() : null;
  const form = sent ? (
    <InlineAlert
      tone="success"
      title={t("sentTitle")}
      action={
        <Button variant="tertiary" size="sm" onClick={() => setSent(null)}>
          {t("another")}
        </Button>
      }
    >
      {t("sentText", { email: sent })}
    </InlineAlert>
  ) : (
    <form className="space-y-4 rounded-md border border-line bg-surface-1 p-5" onSubmit={(e) => void submit(e)} noValidate>
      <Field label={t("topic")} error={errors.topic}>
        {(id, d, invalid) => (
          <Select<Topic>
            id={id}
            aria-describedby={d}
            invalid={invalid}
            value={topic}
            placeholder={t("topicPlaceholder")}
            options={TOPICS.map((x) => ({ value: x, label: t(`topics.${x}`) }))}
            onValueChange={(v) => {
              setTopic(v);
              fix("topic");
            }}
            className="w-full sm:max-w-xs"
          />
        )}
      </Field>
      <Field label={t("message")} hint={t("messageHint")} error={errors.text}>
        {(id, d, invalid) => (
          <Textarea
            id={id}
            aria-describedby={d}
            invalid={invalid}
            rows={6}
            maxLength={4000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              fix("text");
            }}
          />
        )}
      </Field>
      {guest && (
        <Field label={t("email")} error={errors.email}>
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              type="email"
              autoComplete="email"
              maxLength={200}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                fix("email");
              }}
              className="sm:max-w-sm"
            />
          )}
        </Field>
      )}
      {/* People never see this field; a bot that fills it is told "sent" and nothing is kept. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
      />
      <div>
        <Checkbox checked={attach} onCheckedChange={setAttach} label={t("summary")} description={t("summaryHint")} />
        <Button variant="tertiary" size="sm" className="mt-1 ms-8" aria-expanded={showSummary} onClick={() => setShowSummary((v) => !v)}>
          {t("summaryShow")}
        </Button>
        {s && (
          <dl className="ms-8 mt-2 grid gap-1 rounded-md bg-surface-2 p-3 text-caption text-text-2">
            <div>
              <dt className="inline text-text-3">{t("summaryBrowser")}: </dt>
              <dd className="inline break-all">{s.userAgent}</dd>
            </div>
            <div>
              <dt className="inline text-text-3">{t("summaryScreen")}: </dt>
              <dd className="inline">{s.screen}</dd>
            </div>
            <div>
              <dt className="inline text-text-3">{t("summaryInstalled")}: </dt>
              <dd className="inline">{s.installed ? t("yes") : t("no")}</dd>
            </div>
            <div>
              <dt className="inline text-text-3">{t("summaryPlayback")}: </dt>
              <dd className="inline">
                {s.playback ? [s.playback.provider, s.playback.method, s.playback.outcome, s.playback.errorCode, relativeTime(s.playback.at, locale)].filter(Boolean).join(" · ") : t("summaryNoPlayback")}
              </dd>
            </div>
          </dl>
        )}
      </div>
      {siteKey && (
        <div>
          <Turnstile siteKey={siteKey} onToken={setCaptcha} />
          {errors.captcha && (
            <p role="alert" className="mt-1 text-body-s text-danger">
              {errors.captcha}
            </p>
          )}
        </div>
      )}
      {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
      <Button type="submit" loading={busy}>
        {t("send")}
      </Button>
    </form>
  );

  return (
    <div className="space-y-10">
      <section aria-labelledby="support-new" className="space-y-4">
        <h2 id="support-new" className="text-h3 text-text-1">
          {t("newTitle")}
        </h2>
        {form}
      </section>
      {!guest && (
        <section aria-labelledby="support-mine" className="space-y-4">
          <h2 id="support-mine" className="text-h3 text-text-1">
            {t("mine")}
          </h2>
          <QueryState variant="inline" query={mine} isEmpty={(d) => d.requests.length === 0} empty={<EmptyState variant="inline" title={t("mineEmpty")} />}>
            {(d) => (
              <ul className="divide-y divide-line rounded-md border border-line bg-surface-1">
                {d.requests.map((r) => (
                  <li key={r.id}>
                    <Link href={`/support/${r.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-body font-semibold text-text-1">{t(`topics.${r.topic}`)}</span>
                          <StatusBadge status={STATUS_TONE[r.status] ?? "neutral"}>{t(`status.${r.status}`)}</StatusBadge>
                        </span>
                        {r.last && <span className="mt-0.5 line-clamp-1 block text-body-s text-text-2">{r.last.author === "admin" ? `${t("team")}: ${r.last.text}` : r.last.text}</span>}
                        <span className="block text-caption text-text-3">{t("updated", { when: relativeTime(r.updatedAt, locale) })}</span>
                      </span>
                      <ChevronRight aria-hidden className="size-5 shrink-0 text-text-3 rtl:-scale-x-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </section>
      )}
    </div>
  );
}
