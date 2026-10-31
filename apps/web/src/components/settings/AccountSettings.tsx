"use client";

import type { AuthCapabilities } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { authCall } from "@/components/auth/auth-call";
import { useSession } from "@/components/providers/Providers";
import { StatusBadge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { authErrorKey } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";

const SOCIAL = [
  { id: "google", name: "Google" },
  { id: "apple", name: "Apple" },
  { id: "discord", name: "Discord" },
] as const;

/**
 * Settings → Account (S16): the account's e-mail and the ways to sign in. The password and two-step verification
 * live together in Security (SET-07). A provider the server has no credentials for isn't offered (AUTH-10); one
 * that is linked stays listed either way.
 */
export function AccountSettings() {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const tr = useTranslations();
  const { me } = useSession();
  const caps = useQuery({ queryKey: ["auth-caps"], queryFn: () => api<AuthCapabilities>("/api/auth-capabilities"), staleTime: Infinity });
  const [linking, setLinking] = useState<string | null>(null);
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
  const social = SOCIAL.filter((m) => linked.has(m.id) || caps.data?.[m.id]);

  return (
    <div className="space-y-6">
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
        <SettingsRow
          label={ta("emailAndPassword")}
          description={linked.has("credential") ? t("passwordInSecurity") : t("noPasswordHint")}
        >
          {linked.has("credential") ? (
            <Link href="/settings/security" className={buttonClass("tertiary")}>
              {t("changePassword")}
            </Link>
          ) : (
            <StatusBadge status="neutral">{t("notLinked")}</StatusBadge>
          )}
        </SettingsRow>
        {caps.isPending && (
          <div className="py-4">
            <Skeleton shape="xs" className="h-5 w-40" />
          </div>
        )}
        {social.map((m) => (
          <SettingsRow key={m.id} label={m.name}>
            {linked.has(m.id) ? (
              <StatusBadge status="success">{t("linked")}</StatusBadge>
            ) : (
              <Button variant="secondary" size="sm" loading={linking === m.id} onClick={() => void link(m.id)}>
                {t("linkProvider", { provider: m.name })}
              </Button>
            )}
          </SettingsRow>
        ))}
      </SettingsSection>
    </div>
  );
}
