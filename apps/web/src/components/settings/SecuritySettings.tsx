"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { SettingsLink, SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Sessions } from "./Sessions";

// The forms load when they are opened (bundle budget).
const PasswordDialog = dynamic(() => import("./SecurityDialogs").then((m) => m.PasswordDialog), { ssr: false });
const TwoFactorDialog = dynamic(() => import("./SecurityDialogs").then((m) => m.TwoFactorDialog), { ssr: false });

/**
 * Settings → Security: who can get into the account. Two rows that say their
 * state — "Change password", "Two-step verification · Off" — each opening its form in a dialog (no empty password form on
 * the page); then where the account is signed in, and "Remove all other devices" last. Without a password (Google,
 * Apple or Discord only) two-step verification is off with the reason under it; an administrator is told it is needed
 * for the admin mode.
 */
export function SecuritySettings() {
  const t = useTranslations("settings");
  const { me } = useSession();
  const [open, setOpen] = useState<"password" | "2fa" | null>(null);
  // What the dialog just did, until the session says the same: the row follows at once.
  const [changed, setChanged] = useState<boolean | null>(null);
  const [seen, setSeen] = useState(me?.user.twoFactorEnabled);
  if (seen !== me?.user.twoFactorEnabled) {
    setSeen(me?.user.twoFactorEnabled);
    setChanged(null);
  }
  if (!me) return null;
  const hasPassword = me.linkedProviders.includes("credential");
  const on = changed ?? me.user.twoFactorEnabled;
  const admin = me.user.role === "admin";

  return (
    <div className="space-y-8">
      <SettingsSection>
        {hasPassword ? (
          <SettingsLink label={t("changePassword")} opens onClick={() => setOpen("password")} />
        ) : (
          <SettingsRow label={t("noPassword")} description={t("noPasswordHint")}>
            {null}
          </SettingsRow>
        )}
        <SettingsLink
          label={t("twoFactor")}
          value={on ? t("twoFactorOn") : t("twoFactorOff")}
          // Why it can't be turned on, next to it; the admin mode needs it.
          detail={!hasPassword ? t("twoFactorNeedsPassword") : admin && !on ? t("twoFactorAdmin") : undefined}
          opens
          disabled={!hasPassword}
          onClick={() => setOpen("2fa")}
        />
      </SettingsSection>
      <Sessions />
      {open === "password" && <PasswordDialog onClose={() => setOpen(null)} />}
      {open === "2fa" && <TwoFactorDialog enabled={on} onChanged={setChanged} onClose={() => setOpen(null)} />}
    </div>
  );
}
