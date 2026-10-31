"use client";

import type { AuthCapabilities } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { authCall } from "@/components/auth/auth-call";
import { useSession } from "@/components/providers/Providers";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { authErrorKey } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";
import { usePrefs } from "./prefs";

/**
 * Settings → Notifications (S22, audit SET-10): one section. The e-mail switch applies at once with "Saved"; Discord
 * appears only when this server has it configured — no panel saying it isn't.
 */
export function NotificationSettings() {
  const t = useTranslations("settings");
  const tr = useTranslations();
  const ids = useId();
  const { me } = useSession();
  const { query, set, state } = usePrefs();
  const caps = useQuery({ queryKey: ["auth-caps"], queryFn: () => api<AuthCapabilities>("/api/auth-capabilities"), staleTime: Infinity });
  const [linking, setLinking] = useState(false);
  const discordLinked = me?.linkedProviders.includes("discord") ?? false;
  const linkDiscord = async () => {
    setLinking(true);
    const r = await authCall(() => authClient.linkSocial({ provider: "discord", callbackURL: window.location.href }));
    if (r.error) {
      setLinking(false);
      toast.error(tr(authErrorKey(r.error)));
    }
  };

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
      {caps.data?.discord && (
        <SettingsRow label={t("discord")} description={t("discordHint")}>
          {discordLinked ? (
            <StatusBadge status="success">{t("linked")}</StatusBadge>
          ) : (
            <Button variant="secondary" size="sm" loading={linking} onClick={() => void linkDiscord()}>
              {t("linkProvider", { provider: "Discord" })}
            </Button>
          )}
        </SettingsRow>
      )}
    </SettingsSection>
  );
}
