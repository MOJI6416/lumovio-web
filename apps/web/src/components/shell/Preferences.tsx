"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { interfaceLocaleOptions, isInterfaceLocale } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";
import { getThemePref, onThemeChange, setTheme, type ThemePref } from "@/lib/prefs";

/*
 * Theme and interface language, for everyone — the header's "Language and theme" for guests (SH-07), the account menu
 * for the signed in (SH-08), the sign-in pages' language field. One state for all: choosing in one place updates the rest.
 */

export const THEMES: ThemePref[] = ["dark", "light", "system"];
export const themeKey = (m: ThemePref) => (m === "dark" ? "themeDark" : m === "light" ? "themeLight" : "themeSystem");

/** The chosen theme and a setter; the server and the first render say "dark" (the default). */
export function useThemePref() {
  const [pref, setPref] = useState<ThemePref>("dark");
  useEffect(() => {
    setPref(getThemePref());
    return onThemeChange(setPref);
  }, []);
  return [pref, setTheme] as const;
}

/** The interface languages to offer (finished ones, plus the current draft so it can be left) and a switch. */
export function useInterfaceLanguage() {
  const locale = useLocale();
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const options = interfaceLocaleOptions(locale).map((l) => ({
    value: l.code as string,
    label: isInterfaceLocale(l.code) ? l.name : tc("languageDraft", { name: l.name }),
  }));
  // The same page in the other language, with its query (a search, a tab, filters) kept.
  const choose = (code: string) =>
    start(() => router.replace(`${pathname}${window.location.search}`, { locale: code as never, scroll: false }));
  return { locale, options, choose, pending };
}

export function ThemeSwitch({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const [pref, set] = useThemePref();
  return (
    <SegmentedControl
      label={t("theme")}
      value={pref}
      onValueChange={set}
      options={THEMES.map((m) => ({ value: m, label: t(themeKey(m)) }))}
      className={className}
    />
  );
}

export function LanguageSelect({ id, className }: { id?: string; className?: string }) {
  const t = useTranslations("shell");
  const { locale, options, choose, pending } = useInterfaceLanguage();
  return (
    <Select
      id={id}
      value={locale}
      onValueChange={choose}
      options={options}
      disabled={pending}
      aria-label={id ? undefined : t("interfaceLanguage")}
      className={className}
    />
  );
}

/** The interface language with its visible label (sign-in pages, the menus' sheets on a phone). */
export function LanguageField({ className }: { className?: string }) {
  const t = useTranslations("shell");
  return (
    <Field label={t("interfaceLanguage")} className={className}>
      {(id) => <LanguageSelect id={id} />}
    </Field>
  );
}
