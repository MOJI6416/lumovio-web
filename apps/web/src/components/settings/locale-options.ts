"use client";

import { useLocale, useTranslations } from "next-intl";
import { CONTENT_LOCALES, interfaceLocaleOptions, isInterfaceLocale } from "@/i18n/locales";
import { languageName, regionName } from "@/lib/format";

/** The regions offered for age ratings, release dates and streaming offers. */
export const REGIONS = ["US", "GB", "UA", "DE", "FR", "ES", "IT", "PL", "TR", "BR", "PT", "NL", "SE", "JP", "KR", "CN", "IN", "ID", "SA", "AE", "CA", "AU", "MX", "AR", "KZ", "RU"];
// Radix lists keep "" for "nothing chosen": the "automatic" choices get a value of their own.
export const AUTO = "auto";

/** "Английский", not "английский": a language as an item of a list. */
export const capital = (s: string, locale: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

/**
 * The interface, description and region choices shared by Settings → Profile and the profile editor in Manage
 * profiles. A light module: the editor doesn't bring the settings' release data with it.
 */
export function useLocaleOptions() {
  const t = useTranslations("profiles");
  const tc = useTranslations("common");
  const locale = useLocale();
  return {
    ui: (current: string | null) => [
      { value: AUTO, label: t("uiLanguageDevice") },
      ...interfaceLocaleOptions(current).map((l) => ({
        value: l.code as string,
        label: isInterfaceLocale(l.code) ? l.name : tc("languageDraft", { name: l.name }),
      })),
    ],
    metadata: [
      { value: AUTO, label: t("sameAsInterface") },
      ...CONTENT_LOCALES.map((l) => ({
        value: l.code as string,
        label: l.status === "draft" ? tc("languageDraft", { name: l.name }) : l.name,
        keywords: [l.code, languageName(l.code, locale) ?? ""],
      })),
    ],
    region: [
      { value: AUTO, label: t("automatic") },
      ...REGIONS.map((r) => ({ value: r, label: regionName(r, locale) ?? r, keywords: [r] })),
    ],
  };
}
