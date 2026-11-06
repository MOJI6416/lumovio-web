"use client";

import type { AuthCapabilities } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { authCall } from "@/components/auth/auth-call";
import { useSession } from "@/components/providers/Providers";
import { SIGNED_OUT_KEY } from "@/components/shell/AccountMenu";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SettingsLink, SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { authErrorKey } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";

const SOCIAL = [
  { id: "google", name: "Google" },
  { id: "apple", name: "Apple" },
  { id: "discord", name: "Discord" },
] as const;

/**
 * Settings → Account (S16, design-system 7.18): the account's e-mail and whether it is confirmed, the ways to sign in —
 * e-mail and password (changed in Security), Google, Apple, Discord — and "Sign out" on this device at the end, as in the
 * account menu. A provider the server has no credentials for isn't offered (AUTH-10); one that is linked stays listed
 * either way. Deleting the account is in Privacy and data, with the rest of the account's data.
 */
export function AccountSettings() {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const locale = useLocale();
  const { me } = useSession();
  const caps = useQuery({ queryKey: ["auth-caps"], queryFn: () => api<AuthCapabilities>("/api/auth-capabilities"), staleTime: Infinity });
  const [linking, setLinking] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  if (!me) return null;
  const linked = new Set(me.linkedProviders);
  const link = async (provider: string) => {
    setLinking(provider);
    const r = await authCall(() => authClient.linkSocial({ provider: provider as "google", callbackURL: window.location.href }));
    // Success leaves for the provider's page; only a refusal comes back here.
    if (r.error) {
      setLinking(null);
      toast.error(tr(authErrorKey(r.error)));
    }
  };
  // As the account menu's "Sign out": the session ends here only, the home page says so.
  const signOut = async () => {
    setLeaving(true);
    const r = await authCall(() => authClient.signOut());
    if (r.error) {
      setLeaving(false);
      toast.error(tr(authErrorKey(r.error)));
      return;
    }
    // A TorrServer password the service worker holds for the player goes with the session.
    navigator.serviceWorker?.controller?.postMessage({ type: "lumovio:forget-credentials" });
    try {
      sessionStorage.setItem(SIGNED_OUT_KEY, "1");
    } catch {
      // Without storage the home page simply doesn't say it.
    }
    window.location.href = locale === "en" ? "/" : `/${locale}`;
  };
  const social = SOCIAL.filter((m) => linked.has(m.id) || caps.data?.[m.id]);

  return (
    <div className="space-y-8">
      <SettingsSection title={t("emailSection")}>
        <SettingsRow label={me.user.email} description={me.user.emailVerified ? undefined : t("emailNotVerifiedHint")}>
          {me.user.emailVerified ? (
            <StatusBadge status="success">{t("emailVerified")}</StatusBadge>
          ) : (
            <StatusBadge status="warning">{t("emailNotVerified")}</StatusBadge>
          )}
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title={t("signInMethods")} description={t("signInMethodsHint")}>
        {/* The password itself is changed in Security, where two-step verification is. */}
        {linked.has("credential") ? (
          <SettingsLink href="/settings/security" label={ta("emailAndPassword")} value={t("linked")} />
        ) : (
          <SettingsRow label={ta("emailAndPassword")} description={t("noPasswordHint")}>
            <span className="text-body text-text-2">{t("notLinked")}</span>
          </SettingsRow>
        )}
        {caps.isPending && (
          <div className="py-4">
            <Skeleton shape="xs" className="h-5 w-40" />
          </div>
        )}
        {social.map((m) => (
          <SettingsRow key={m.id} label={m.name}>
            {linked.has(m.id) ? (
              <span className="text-body text-text-2">{t("linked")}</span>
            ) : (
              <Button variant="secondary" size="sm" loading={linking === m.id} onClick={() => void link(m.id)}>
                {t("linkProvider", { provider: m.name })}
              </Button>
            )}
          </SettingsRow>
        ))}
      </SettingsSection>
      <SettingsSection>
        <SettingsLink label={leaving ? tc("loading") : tc("signOut")} disabled={leaving} onClick={() => void signOut()} />
      </SettingsSection>
    </div>
  );
}
