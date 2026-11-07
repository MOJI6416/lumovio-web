"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { SettingsLink, SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { ApiRequestError, api } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { useAction } from "@/lib/use-action";
import { type Prefs, usePrefs } from "./prefs";
import { useDiscardGuard } from "./use-unsaved";

/** A channel webhook's address as Discord gives it (the API checks it again, account/discord.ts). */
const DISCORD_WEBHOOK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d{15,22}\/[\w-]{20,}$/;

/**
 * Settings → Notifications (S22, audit SET-10): where the news of new episodes goes — by e-mail (a switch, applied at
 * once with "Saved") and to a Discord channel (a row with its state opening a dialog: the channel webhook's address,
 * checked with Discord before it is kept; then a test message and "Disconnect" with "Undo"). When mail to the address
 * bounced or was marked as spam, the switch is off and a warning under it says why (switching it on again clears it).
 */
export function NotificationSettings() {
  const t = useTranslations("settings");
  const ids = useId();
  const { me } = useSession();
  const { query, set, state } = usePrefs();
  const [discord, setDiscord] = useState(false);
  // Mail to this address bounced or was marked as spam, so the API switched it off (account/mail-events.ts).
  const stopped = query.data?.emailBounce && !query.data.emailNotifications ? query.data.emailBounce : null;

  if (query.isError && !query.data) {
    return (
      <SettingsSection title={t("newEpisodesSection")}>
        <ErrorState error={query.error} title={t("prefsLoadError")} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </SettingsSection>
    );
  }
  const connected = query.data?.discord ?? null;
  return (
    <SettingsSection title={t("newEpisodesSection")} save={state}>
      <SettingsRow label={t("emailRow")} description={t("emailNotificationsHint")} htmlFor={`${ids}-email`}>
        {query.data ? (
          <Switch id={`${ids}-email`} hideLabel label={t("emailNotifications")} checked={query.data.emailNotifications} onCheckedChange={(v) => set({ emailNotifications: v })} />
        ) : (
          <Skeleton shape="full" className="h-6 w-11" />
        )}
      </SettingsRow>
      {stopped && (
        <InlineAlert
          tone="warning"
          className="mb-4"
          title={t("emailStoppedTitle")}
          action={
            stopped.reason === "bounced" ? (
              <Link variant="action" href="/settings/account">
                {t("account")}
              </Link>
            ) : undefined
          }
        >
          {t(stopped.reason === "bounced" ? "emailBouncedText" : "emailComplainedText", { email: me?.user.email ?? "" })}
        </InlineAlert>
      )}
      <SettingsLink
        label={t("discord")}
        value={query.data ? <span className="truncate">{connected ? connected.name : t("discordOff")}</span> : <Skeleton shape="xs" className="h-4 w-24" />}
        description={t("discordHint")}
        opens
        disabled={!query.data}
        onClick={() => setDiscord(true)}
      />
      {discord && query.data && <DiscordDialog prefs={query.data} onClose={() => setDiscord(false)} />}
    </SettingsSection>
  );
}

/** Discord: the webhook's address to connect; once connected, its name, a test message and "Disconnect" (with "Undo"). */
function DiscordDialog({ prefs, onClose }: { prefs: Prefs; onClose: () => void }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = prefs.discord ?? null;
  const close = useDiscardGuard(url.trim().length > 0, onClose);
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
    <Dialog open onOpenChange={(o) => !o && void close()} title={t("discord")} size="sm">
      <p className="sr-only">{t("discordHint")}</p>
      {connected ? (
        // What can be done with the webhook is rows, not a row of buttons that runs out of the window in a long language
        // (2026-11-07): the test message, then disconnecting — the risky one last, in red, its consequence under it
        // (7.18; it can be undone from the toast). At the bottom only "Done".
        <div className="flex flex-col gap-4">
          <p className="text-body text-text-1">{t("discordWebhookName", { name: connected.name })}</p>
          <SettingsSection raised>
            <SettingsLink label={t("discordTest")} disabled={test.pending} onClick={() => void test.run()} />
          </SettingsSection>
          <SettingsSection raised>
            <SettingsLink
              tone="danger"
              label={tr("services.disconnect")}
              detail={t("discordDisconnectHint")}
              disabled={disconnect.pending}
              onClick={async () => {
                if ((await disconnect.run()).ok) onClose();
              }}
            />
          </SettingsSection>
          <DialogActions className="mt-2">
            <Button onClick={onClose}>{tc("done")}</Button>
          </DialogActions>
        </div>
      ) : (
        <form onSubmit={(e) => void connect(e)} noValidate className="flex flex-col gap-4">
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
          <DialogActions className="mt-2">
            <Button variant="secondary" disabled={busy} onClick={() => void close()}>
              {tc("cancel")}
            </Button>
            {/* Off until something is typed (8.8). */}
            <Button type="submit" loading={busy} disabled={!url.trim()}>
              {tr("services.connect", { service: "Discord" })}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
