"use client";

import { clsx } from "clsx";
import { Bell, ChevronRight, Database, KeyRound, type LucideIcon, MonitorSmartphone, RefreshCw, Server, Shield, Sparkles, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface SettingsSection {
  href: string;
  /** The address in the phone's list of sections, where /settings itself is that list (Profile only). */
  phoneHref?: string;
  label: string;
  icon: LucideIcon;
  kidsToo?: boolean;
}

/**
 * The sections of the settings in menu order; a kids profile has Profile and Recommendations (8.10). Only pages that open
 * inside the settings: the import of history (a page of its own) is offered on the Trakt & Simkl page (SET-03).
 */
export function useSettingsSections(): SettingsSection[] {
  const t = useTranslations();
  return [
    { href: "/settings", phoneHref: "/settings/profile", label: t("settings.profile"), icon: UserRound, kidsToo: true },
    { href: "/settings/recommendations", label: t("recs.title"), icon: Sparkles, kidsToo: true },
    { href: "/settings/account", label: t("settings.account"), icon: KeyRound },
    { href: "/settings/security", label: t("settings.security"), icon: Shield },
    { href: "/settings/devices", label: t("settings.devices"), icon: MonitorSmartphone },
    { href: "/settings/connections", label: t("nav.connections"), icon: Server },
    { href: "/settings/services", label: t("services.title"), icon: RefreshCw },
    { href: "/settings/notifications", label: t("settings.notifications"), icon: Bell },
    { href: "/settings/privacy", label: t("settings.privacy"), icon: Database },
  ];
}

/** Whether `pathname` is in this section: Profile is /settings and /settings/profile, the rest include their sub-pages. */
export function inSection(s: SettingsSection, pathname: string) {
  return s.phoneHref ? pathname === s.href || pathname === s.phoneHref : pathname === s.href || pathname.startsWith(`${s.href}/`);
}

/**
 * The menu of the settings (design-system 7.18, 10.1–10.2, audit SET-03): on a desktop (lg) a list on the left that
 * marks the open section; below lg, the page /settings itself is the list of sections — rows of the SettingsSection
 * look leading to a section's page (which has "← Settings" over its h1) — and a section's page has no menu.
 */
export function SettingsNav({ sections, pathname, index }: { sections: SettingsSection[]; pathname: string; index: boolean }) {
  const t = useTranslations("settings");
  return (
    <nav aria-label={t("title")} className={clsx("lg:sticky lg:top-24 lg:self-start", !index && "max-lg:hidden")}>
      <ul className="max-lg:divide-y max-lg:divide-line max-lg:overflow-hidden max-lg:rounded-md max-lg:border max-lg:border-line max-lg:bg-surface-1 lg:flex lg:flex-col lg:gap-1">
        {sections.map((s) => {
          const active = inSection(s, pathname);
          return (
            <li key={s.href}>
              {/* The phone's and tablet's list: a row per section, its whole width a target (5.6). */}
              <Link
                href={s.phoneHref ?? s.href}
                className="flex min-h-14 items-center gap-3 px-4 text-title text-text-1 transition-colors duration-fast ease-fast hover:bg-surface-2 lg:hidden"
              >
                <s.icon aria-hidden className="size-5 shrink-0 text-text-2" />
                <span className="min-w-0 flex-1">{s.label}</span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-text-3" />
              </Link>
              {/* The desktop's menu on the left. */}
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-3 rounded-sm px-3 py-2.5 text-body font-semibold transition-colors duration-fast ease-fast max-lg:hidden",
                  active ? "bg-surface-2 text-text-1" : "text-text-2 hover:bg-surface-1 hover:text-text-1",
                )}
              >
                <s.icon aria-hidden className="size-4.5 shrink-0" />
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
