"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Textarea } from "@/components/ui/Input";
import { QueryState } from "@/components/ui/QueryState";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { STATUS_TONE } from "./SupportView";

interface Thread {
  id: string;
  topic: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: { id: string; author: string; text: string; createdAt: string }[];
}

/**
 * One of the person's requests (admin handoff «Поддержка», «Мои обращения»): the messages — theirs and the support's —
 * and their answer; a closed one opens again when they answer.
 */
export function SupportThread({ id, email }: { id: string; email: string }) {
  const t = useTranslations("support");
  const tr = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["support", id], queryFn: () => api<Thread>(`/api/support/${encodeURIComponent(id)}`) });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const when = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  const send = async () => {
    setBusy(true);
    try {
      await api(`/api/support/${encodeURIComponent(id)}/messages`, { method: "POST", json: { text: text.trim() } });
      setText("");
      toast.success(t("replySent"));
      await Promise.all([qc.invalidateQueries({ queryKey: ["support", id] }), qc.invalidateQueries({ queryKey: ["support"], exact: true })]);
    } catch (e) {
      toast.error(tr(apiErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <QueryState query={q}>
      {(d) => (
        <div className="space-y-6">
          <h2 className="text-h3 text-text-1">{t(`topics.${d.topic}`)}</h2>
          <div className="-mt-4 flex flex-wrap items-center gap-2 text-body-s text-text-2">
            <StatusBadge status={STATUS_TONE[d.status] ?? "neutral"}>{t(`status.${d.status}`)}</StatusBadge>
            <span>{t("written", { date: when.format(new Date(d.createdAt)) })}</span>
          </div>
          <ol className="space-y-3">
            {d.messages.map((m) => (
              <li key={m.id} className={m.author === "admin" ? "rounded-md border border-line bg-surface-2 p-4 md:me-12" : "rounded-md border border-line bg-surface-1 p-4 md:ms-12"}>
                <p className="mb-1 text-caption text-text-3">
                  <span className="font-semibold text-text-2">{m.author === "admin" ? t("team") : t("you")}</span> · {when.format(new Date(m.createdAt))}
                </p>
                <p className="whitespace-pre-wrap text-body text-text-1">{m.text}</p>
              </li>
            ))}
          </ol>
          {d.status === "closed" ? <InlineAlert>{t("closedNote")}</InlineAlert> : d.status !== "waiting" && <p className="text-body-s text-text-2">{t("waitNote", { email })}</p>}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void send();
            }}
          >
            <Field label={t("reply")}>
              {(fid, describedBy) => <Textarea id={fid} aria-describedby={describedBy} rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />}
            </Field>
            <Button type="submit" loading={busy} disabled={!text.trim()}>
              {t("replySend")}
            </Button>
          </form>
        </div>
      )}
    </QueryState>
  );
}
