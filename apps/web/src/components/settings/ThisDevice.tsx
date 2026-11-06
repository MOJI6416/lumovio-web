"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { useSession } from "@/components/providers/Providers";
import { LanguageSelect, ThemeSwitch } from "@/components/shell/Preferences";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Switch } from "@/components/ui/Switch";
import { setTvMode } from "@/lib/prefs";

/**
 * Settings of this browser, not of the account (redesign-2026-11.md 5): theme, site language and TV mode — they left
 * the account menu. In Settings → Devices, and on the Profile page of a kids profile (which has no Devices). A visitor
 * who isn't signed in has them behind the Globe button in the header.
 */
export function ThisDevice() {
  const t = useTranslations();
  const { tv } = useSession();
  const langId = useId();
  return (
    <SettingsSection title={t("settings.thisDevice")}>
      <SettingsRow label={t("nav.theme")}>
        <ThemeSwitch />
      </SettingsRow>
      <SettingsRow label={t("shell.interfaceLanguage")} htmlFor={langId}>
        <LanguageSelect id={langId} />
      </SettingsRow>
      <SettingsRow label={t("nav.tvMode")}>
        <Switch checked={tv} onCheckedChange={setTvMode} label={t("nav.tvMode")} hideLabel />
      </SettingsRow>
    </SettingsSection>
  );
}
