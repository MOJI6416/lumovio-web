"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { inboxOf } from "./inboxes";
import { clock, FormError, RESEND_AFTER, Screen, useCountdown, useWait } from "./shared";

/**
 * "Check your email" after a confirmation or a reset link went out (AUTH-09): the address it went to, "Open email" for
 * a known mail service, "Send again" after a minute, "Change address" back to the form, and the way back (`back`).
 * `send` sends the letter again and answers with the error's key and the wait the API asked for; `extra` — the
 * captcha a resend needs.
 */
export function SentScreen({
  email,
  text,
  sentAt,
  send,
  onSent,
  onChange,
  extra,
  back,
}: {
  email: string;
  text: string;
  sentAt: number;
  send: () => Promise<{ key: string | null; wait: number }>;
  onSent: (at: number) => void;
  onChange: () => void;
  extra?: ReactNode;
  back?: ReactNode;
}) {
  const t = useTranslations("auth");
  const tr = useTranslations();
  const left = useCountdown(sentAt + RESEND_AFTER * 1000);
  const [wait, hold] = useWait();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [resent, setResent] = useState(false);
  const inbox = inboxOf(email);
  const resend = async () => {
    setBusy(true);
    setError(undefined);
    setResent(false);
    const { key, wait } = await send();
    setBusy(false);
    if (wait) return hold(wait);
    if (key) return setError(tr(key));
    setResent(true);
    onSent(Date.now());
  };
  return (
    <Screen title={t("checkEmailTitle")} lead={text}>
      <div className="flex flex-col gap-3">
        {resent && <InlineAlert tone="success">{t("resent")}</InlineAlert>}
        <FormError text={error} wait={wait} />
        {inbox && (
          <a href={inbox} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "lg", "w-full")}>
            <ExternalLink aria-hidden className="size-5" />
            {t("openMail")}
          </a>
        )}
        {extra}
        <Button
          variant="secondary"
          size="lg"
          className="w-full tabular-nums"
          loading={busy}
          disabled={left > 0 || wait > 0}
          onClick={() => void resend()}
        >
          {left > 0 ? t("resendIn", { time: clock(left) }) : t("resend")}
        </Button>
        <Button variant="tertiary" className="w-full" onClick={onChange}>
          {t("changeEmail")}
        </Button>
      </div>
      {back}
    </Screen>
  );
}
