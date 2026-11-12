"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { authCall } from "@/components/auth/auth-call";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SettingsLink, SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";
import { authErrorKey } from "@/lib/api-errors";
import { type Prefs, usePrefs } from "./prefs";

/** The auth client (Better Auth) loads with the action that needs it, not in the page's first-load JS (bundle budget). */
const auth = () => import("@/lib/auth-client").then((m) => m.authClient);

/**
 * Settings → Privacy and data: what AI search may read, a copy of everything, and — apart and
 * last — deleting the account, its consequence said under it and asked with a typed word. The profile's
 * public page is the profile's (Settings → Profile).
 */
export function PrivacySettings() {
  const t = useTranslations("settings");
  return (
    <div className="space-y-8">
      <AiSection />
      <SettingsSection title={t("exportSection")}>
        <SettingsLink
          href="/api/export"
          download=""
          label={t("exportLabel")}
          description={t("exportHint")}
          value={
            <span className="inline-flex items-center gap-1.5 font-semibold text-text-1">
              <Download aria-hidden className="size-4" />
              {t("exportButton")}
            </span>
          }
        />
      </SettingsSection>
      <DangerZone />
    </div>
  );
}

/** What AI search may read: said in the same words as the recommendations page. */
function AiSection() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const ids = useId();
  const { query, set, state } = usePrefs();
  return (
    <SettingsSection title={t("aiSection")} save={state}>
      <SettingsRow label={t("aiHistory")} description={t("aiHistoryHint")} htmlFor={`${ids}-ai`}>
        {query.data ? (
          <Switch id={`${ids}-ai`} hideLabel label={t("aiHistory")} checked={query.data.aiHistoryOptIn} onCheckedChange={(v) => set({ aiHistoryOptIn: v } satisfies Partial<Prefs>)} />
        ) : query.isError ? (
          <Button variant="tertiary" size="sm" loading={query.isFetching} onClick={() => void query.refetch()}>
            {tc("retry")}
          </Button>
        ) : (
          <Skeleton shape="full" className="h-6 w-11" />
        )}
      </SettingsRow>
    </SettingsSection>
  );
}

/** The last group: deleting the account, confirmed by typing a word; it goes after the link in the e-mail. */
function DangerZone() {
  const t = useTranslations("settings");
  const tr = useTranslations();
  const confirm = useConfirm();
  const remove = async () => {
    const ok = await confirm({
      title: t("deleteTitle"),
      text: t("deleteHint"),
      confirmLabel: t("deleteAccount"),
      confirmWord: t("deleteWord"),
      action: async () => {
        const r = await authCall(async () => (await auth()).deleteUser({ callbackURL: "/?account=deleted" }));
        if (r.error) throw new Error(tr(authErrorKey(r.error)));
      },
      error: (e) => (e instanceof Error ? e.message : tr("errors.generic")),
    });
    if (ok) toast.success(t("deleteSent"));
  };
  return (
    <SettingsSection title={t("dangerZone")}>
      <SettingsLink tone="danger" label={t("deleteAccount")} detail={t("deleteHint")} onClick={() => void remove()} />
    </SettingsSection>
  );
}
