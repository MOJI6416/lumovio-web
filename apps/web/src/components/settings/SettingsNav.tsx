"use client";

import { clsx } from "clsx";
import { Bell, ChevronRight, Database, KeyRound, LifeBuoy, type LucideIcon, MonitorSmartphone, RefreshCw, Server, Shield, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/Providers";
import { ProfileAvatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { prefetchSection } from "./queries";

/** Whose setting it is: the profile's, this browser's, the account's — and help. */
export type SettingsGroup = "profile" | "device" | "account" | "help";

export interface SettingsSection {
  href: string;
  /** The address in the phone's list of sections, where /settings itself is that list (Profile only). */
  phoneHref?: string;
  label: string;
  /** Profile has the profile's avatar in place of an icon. */
  icon?: LucideIcon;
  group: SettingsGroup;
  kidsToo?: boolean;
}

/**
 * The sections of the settings in menu order, grouped by whose they are:
 * the profile (Profile — the profile's own
 * card at the top — and Recommendations), this device, the account, and Support. A kids profile has its profile's two
 * and This device. The import of history is a page of its own, offered on the Sync page.
 */
export function useSettingsSections(): SettingsSection[] {
  const t = useTranslations();
  return [
    { href: "/settings", phoneHref: "/settings/profile", label: t("settings.profile"), group: "profile", kidsToo: true },
    { href: "/settings/recommendations", label: t("recs.title"), icon: Sparkles, group: "profile", kidsToo: true },
    { href: "/settings/devices", label: t("settings.thisDevice"), icon: MonitorSmartphone, group: "device", kidsToo: true },
    { href: "/settings/account", label: t("settings.account"), icon: KeyRound, group: "account" },
    { href: "/settings/security", label: t("settings.security"), icon: Shield, group: "account" },
    { href: "/settings/connections", label: t("nav.connections"), icon: Server, group: "account" },
    { href: "/settings/services", label: t("services.title"), icon: RefreshCw, group: "account" },
    { href: "/settings/notifications", label: t("settings.notifications"), icon: Bell, group: "account" },
    { href: "/settings/privacy", label: t("settings.privacy"), icon: Database, group: "account" },
    // Support opens as its own page (the form and «Мои обращения»).
    { href: "/support", label: t("support.title"), icon: LifeBuoy, group: "help" },
  ];
}

/** Whether `pathname` is in this section: Profile is /settings and /settings/profile, the rest include their sub-pages. */
export function inSection(s: SettingsSection, pathname: string) {
  return s.phoneHref ? pathname === s.href || pathname === s.phoneHref : pathname === s.href || pathname.startsWith(`${s.href}/`);
}

const GROUPS: SettingsGroup[] = ["profile", "device", "account", "help"];

/**
 * The menu of the settings: on a desktop (lg) a column on the left — the profile's card
 * (its avatar and name: whose settings these are), then the sections in groups split by space, the open one marked; below
 * lg the page /settings itself is that list — the card and the groups as panels of rows — and a section's page has
 * "← Settings" over its h1 and no menu.
 */
export function SettingsNav({ sections, pathname, index, className }: { sections: SettingsSection[]; pathname: string; index: boolean; className?: string }) {
  const t = useTranslations("settings");
  const tp = useTranslations("profiles");
  const { me } = useSession();
  const qc = useQueryClient();
  const profile = me?.activeProfile;
  const groups = GROUPS.map((g) => sections.filter((s) => s.group === g)).filter((g) => g.length > 0);
  return (
    // Sticks where it starts — right under the site's header — so it never slides by the page's h1 beside it.
    <nav aria-label={t("title")} className={clsx("lg:sticky lg:top-(--header-h) lg:self-start", !index && "max-lg:hidden", className)}>
      <ul className="flex flex-col gap-6 lg:gap-5">
        {groups.map((items) => (
          <li key={items[0]!.group}>
            <ul className="max-lg:divide-y max-lg:divide-line max-lg:overflow-hidden max-lg:rounded-md max-lg:bg-surface-1 lg:flex lg:flex-col lg:gap-0.5">
              {items.map((s) => {
                const active = inSection(s, pathname);
                // A section is prefetched whole — its server part too, not only the loading boundary there isn't — so
                // the press shows it from the router's cache, without a trip to the server (~0.3 s felt
                // heavy). Support is a page of its own, as any link.
                const full = s.group !== "help" ? true : undefined;
                // Its data too, from the first sign of the person heading there (pointer, focus, press).
                const ahead = full ? () => prefetchSection(qc, s.href, profile?.id) : undefined;
                const intent = { onPointerEnter: ahead, onFocus: ahead, onPointerDown: ahead };
                const card = !s.icon && profile;
                const mark = card ? (
                  <ProfileAvatar avatar={profile.avatar} photo={profile.photo} name={profile.name} size={40} />
                ) : s.icon ? (
                  <s.icon aria-hidden className="size-5 shrink-0" />
                ) : null;
                // The profile's card names the profile and says it is its section; a kids profile is marked as in the header.
                const text = card ? (
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-title text-text-1">{profile.name}</span>
                      {profile.isKids && <Tag>{tp("kidsTag")}</Tag>}
                    </span>
                    <span className="block text-body-s text-text-2">{s.label}</span>
                  </span>
                ) : (
                  <span className="min-w-0 flex-1">{s.label}</span>
                );
                return (
                  <li key={s.href}>
                    {/* The phone's and tablet's list: a row per section, its whole width a target. */}
                    <Link
                      href={s.phoneHref ?? s.href}
                      prefetch={full}
                      {...intent}
                      className={clsx(
                        "flex items-center gap-3 px-4 text-body text-text-1 transition-colors duration-fast ease-fast hover:bg-surface-2 focus-visible:-outline-offset-2 lg:hidden",
                        card ? "min-h-18 py-3" : "min-h-13",
                      )}
                    >
                      <span className={clsx("shrink-0", !card && "text-text-2")}>{mark}</span>
                      {text}
                      <ChevronRight aria-hidden className="size-5 shrink-0 text-text-3" />
                    </Link>
                    {/* The desktop's menu on the left. */}
                    <Link
                      href={s.href}
                      prefetch={full}
                      {...intent}
                      // The frame keeps the page where it is (SettingsFrame): no jump to the top.
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "flex items-center gap-3 rounded-sm px-3 text-body transition-colors duration-fast ease-fast max-lg:hidden",
                        card ? "py-2.5" : "min-h-10 py-2",
                        active ? "bg-surface-2 font-semibold text-text-1" : "text-text-2 hover:bg-surface-1 hover:text-text-1",
                      )}
                    >
                      {mark}
                      {text}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
