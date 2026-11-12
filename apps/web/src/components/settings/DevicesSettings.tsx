"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { useSession } from "@/components/providers/Providers";
import { ThemeSwitch } from "@/components/shell/Preferences";
import { SettingsLink, SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Switch } from "@/components/ui/Switch";
import { setOtherAppDefault, useOtherAppDefault } from "@/lib/media/other-app";
import { setTvMode } from "@/lib/prefs";

/**
 * Settings → This device: what belongs to this browser, not to the profile or the account —
 * the theme, the TV mode (the TV shell on this screen) and "Always play in another app" (this device's VLC, Infuse,
 * playlist instead of the player) — and, for an adult, the ways to the TV: pairing one by its
 * code, the phone remote, the Android TV app. The interface language is the profile's (Settings → Profile), so it isn't
 * asked twice. Where the account is signed in is Security's.
 */
export function DevicesSettings() {
  const t = useTranslations();
  const { me, tv } = useSession();
  const kids = me?.activeProfile?.isKids ?? false;
  const otherApp = useOtherAppDefault();
  const ids = useId();
  return (
    <div className="space-y-8">
      <SettingsSection>
        <SettingsRow label={t("nav.theme")}>
          <ThemeSwitch />
        </SettingsRow>
        <SettingsRow label={t("nav.tvMode")} description={t("settings.tvModeHint")} htmlFor={`${ids}-tv`}>
          <Switch id={`${ids}-tv`} checked={tv} onCheckedChange={setTvMode} label={t("nav.tvMode")} hideLabel />
        </SettingsRow>
        <SettingsRow label={t("player.alwaysOtherApp")} description={t("settings.otherAppHint")} htmlFor={`${ids}-app`}>
          <Switch id={`${ids}-app`} checked={otherApp} onCheckedChange={setOtherAppDefault} label={t("player.alwaysOtherApp")} hideLabel />
        </SettingsRow>
      </SettingsSection>
      {/* Pairing a TV, the remote and the app are an adult's (/link and /remote refuse a kids profile). */}
      {!kids && (
        <SettingsSection title={t("settings.linkTvLabel")}>
          <SettingsLink href="/link" label={t("nav.linkDevice")} />
          <SettingsLink href="/remote" label={t("settings.remoteLabel")} />
          <SettingsLink href="/android-tv" label={t("settings.tvAppLabel")} />
        </SettingsSection>
      )}
    </div>
  );
}
