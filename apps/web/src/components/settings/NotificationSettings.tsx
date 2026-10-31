"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { api, ApiRequestError } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { useAction } from "@/lib/use-action";
import { type Prefs, usePrefs } from "./prefs";

/** A channel webhook's address as Discord gives it (the API checks it again, account/discord.ts). */
const DISCORD_WEBHOOK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d{15,22}\/[\w-]{20,}$/;

/**
 * Settings → Notifications (S22, audit SET-10): one section. The e-mail switch applies at once with "Saved"; Discord
 * gets the same digest through a channel's webhook pasted here (no bot, no account link): the address is checked
 * with Discord before it is kept, then a test message and "Disconnect" with "Undo".
 */
export function NotificationSettings() {
  const t = useTranslations("settings");
  const ids = useId();
  const { query, set, state } = usePrefs();

  if (query.isError && !query.data) {
    return (
      <SettingsSection title={t("notifications")}>
        <ErrorState error={query.error} title={t("prefsLoadError")} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </SettingsSection>
    );
  }
  return (
    <SettingsSection title={t("notifications")} save={state}>
      <SettingsRow label={t("emailNotifications")} description={t("emailNotificationsHint")} htmlFor={`${ids}-email`}>
        {query.data ? (
          <Switch
            id={`${ids}-email`}
            hideLabel
            label={t("emailNotifications")}
            checked={query.data.emailNotifications}
            onCheckedChange={(v) => set({ emailNotifications: v })}
          />
        ) : (
          <Skeleton shape="full" className="h-6 w-11" />
        )}
      </SettingsRow>
      <DiscordSetting prefs={query.data} />
    </SettingsSection>
  );
}

function DiscordSetting({ prefs }: { prefs: Prefs | undefined }) {
  const t = useTranslations("settings");
  const tr = useTranslations();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = prefs?.discord ?? null;
  const put = (discord: Prefs["discord"]) =>
    qc.setQueryData<Prefs>(["prefs"], (d) => d && { ...d, discord, discordNotifications: Boolean(discord) });

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    const value = url.trim();
    if (!DISCORD_WEBHOOK.test(value)) {
      setError(t("discordInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ name: string }>("/api/preferences/discord", { method: "PUT", json: { url: value } });
      put({ name: r.name });
      setUrl("");
    } catch (err) {
      const issue = err instanceof ApiRequestError ? err.issues?.find((i) => i.path === "url")?.message : undefined;
      setError(issue === "unknown" ? t("discordUnknown") : issue === "invalid" ? t("discordInvalid") : tr(apiErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const test = useAction({
    run: () => api("/api/preferences/discord/test", { method: "POST", json: {} }),
    success: () => t("discordTestSent"),
    // Deleted in Discord meanwhile: the API forgot it, so the form comes back.
    error: (e) => {
      if (e instanceof ApiRequestError && e.issues?.some((i) => i.message === "unknown")) {
        put(null);
        return t("discordUnknown");
      }
      return undefined;
    },
  });

  const disconnect = useAction({
    run: () => api<{ undoKey: string | null }>("/api/preferences/discord", { method: "DELETE" }),
    optimistic: () => {
      const before = connected;
      put(null);
      return () => put(before);
    },
    success: () => t("discordDisconnected"),
    undo: (r) =>
      r.undoKey
        ? api<{ name: string }>("/api/preferences/discord/restore", { method: "POST", json: { undoKey: r.undoKey } }).then((back) => put({ name: back.name }))
        : Promise.reject(new Error("nothing to undo")),
    sync: () => qc.invalidateQueries({ queryKey: ["prefs"] }),
  });

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <h3 className="text-title text-text-1">{t("discord")}</h3>
          <p className="mt-1 max-w-measure text-body-s text-text-2">{t("discordHint")}</p>
        </div>
        {!prefs ? (
          <Skeleton shape="full" className="h-6 w-24" />
        ) : (
          connected && <StatusBadge status="success">{t("discordOn")}</StatusBadge>
        )}
      </div>
      {prefs &&
        (connected ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-body-s text-text-2">{t("discordWebhookName", { name: connected.name })}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" loading={test.pending} onClick={() => void test.run()}>
                {t("discordTest")}
              </Button>
              <Button variant="tertiary" size="sm" disabled={disconnect.pending} onClick={() => void disconnect.run()}>
                {tr("services.disconnect")}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void connect(e)} noValidate className="mt-3 flex flex-col gap-3">
            <Field label={t("discordWebhook")} hint={t("discordWebhookHint")} error={error}>
              {(id, d, invalid) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  invalid={invalid}
                  type="url"
                  inputMode="url"
                  value={url}
                  maxLength={300}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://discord.com/api/webhooks/…"
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                />
              )}
            </Field>
            <div>
              {/* Off until something is typed (8.8). */}
              <Button type="submit" loading={busy} disabled={!url.trim()}>
                {tr("services.connect", { service: "Discord" })}
              </Button>
            </div>
          </form>
        ))}
    </div>
  );
}
