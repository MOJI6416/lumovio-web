"use client";

import { Film, Home, Library, type LucideIcon, Search, Settings, Sparkles, Tv } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/Providers";
import { ProfileAvatar } from "@/components/ui/Avatar";
import { cn } from "@/components/ui/cn";
import { Link, usePathname } from "@/i18n/navigation";
import { showsAnime } from "@/lib/show-anime";

/*
 * The TV shell's menu: a rail of icons along the start edge,
 * always there and always the same, that opens with its labels over a scrim when the focus comes to it (← from the
 * first item of a screen, or Back). The current section is marked in lime; the profile is at the top, the settings at
 * the bottom. ↑/↓ inside, → back to where the screen was (tvui/nav/TvNav).
 */

interface Item {
  href: string;
  key: string;
  icon: LucideIcon;
  label: string;
  on: boolean;
}

export function NavRail() {
  const t = useTranslations("nav");
  const tv = useTranslations("tvui");
  const pathname = usePathname();
  const { me } = useSession();
  const profile = me?.activeProfile;
  const at = (p: string) => pathname === p || pathname.startsWith(`${p}/`);

  const items: Item[] = [
    { href: "/search", key: "search", icon: Search, label: t("search"), on: at("/search") },
    { href: "/", key: "home", icon: Home, label: t("home"), on: pathname === "/" },
    { href: "/browse/movie", key: "movies", icon: Film, label: t("movies"), on: at("/browse/movie") },
    { href: "/browse/tv", key: "series", icon: Tv, label: t("series"), on: at("/browse/tv") },
    // Only while the profile has anime on.
    ...(showsAnime(me) ? [{ href: "/anime", key: "anime", icon: Sparkles, label: t("anime"), on: at("/anime") }] : []),
    {
      href: "/library",
      key: "library",
      icon: Library,
      label: t("library"),
      on: at("/library") || at("/lists"),
    },
  ];
  const settings: Item = {
    href: "/settings",
    key: "settings",
    icon: Settings,
    label: t("settings"),
    on: at("/settings"),
  };

  const link = (i: Item) => (
    <Link
      prefetch={false}
      key={i.key}
      href={i.href}
      data-key={i.key}
      aria-current={i.on ? "page" : undefined}
      className="tv-focus group/item flex h-11 items-center gap-5 rounded-full px-3.5 text-text-2 focus:bg-text-1 focus:text-bg aria-[current=page]:not-focus:text-text-1"
    >
      <i.icon aria-hidden className={cn("size-6 shrink-0", i.on && "text-accent group-focus/item:text-bg")} />
      <span className="truncate text-body font-semibold opacity-0 transition-opacity duration-base group-focus-within/rail:opacity-100">
        {i.label}
      </span>
    </Link>
  );

  return (
    <nav
      aria-label={t("mainMenu")}
      data-zone="nav"
      data-zone-axis="y"
      data-zone-entry="current"
      className="group/rail stage fixed inset-y-0 start-0 z-header flex w-(--tv-rail) flex-col bg-stage"
    >
      {/* The open menu's panel: a scrim that hides what is under the labels (no blur on a TV). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 w-(--tv-rail-open) bg-linear-to-r from-bg via-bg/95 to-transparent opacity-0 transition-opacity duration-base group-focus-within/rail:opacity-100"
      />
      {/* Folded, the items are as wide as the rail, so the pointer of LG's remote over the screen never lands on them. */}
      <div className="relative flex h-full w-(--tv-rail) flex-col gap-3 overflow-hidden px-4 py-10 transition-[width] duration-base group-focus-within/rail:w-(--tv-rail-open)">
        {profile && (
          <Link
            prefetch={false}
            href="/profiles?switch=1"
            data-key="profile"
            aria-label={tv("switchProfile", { name: profile.name })}
            className="tv-focus group/item mb-6 flex h-11 items-center gap-4 rounded-full ps-1 pe-4 text-text-1 focus:bg-text-1 focus:text-bg"
          >
            <ProfileAvatar avatar={profile.avatar} photo={profile.photo} name={profile.name} size="2.25rem" />
            <span className="truncate text-body font-semibold opacity-0 transition-opacity duration-base group-focus-within/rail:opacity-100">
              {profile.name}
            </span>
          </Link>
        )}
        <div className="flex flex-1 flex-col justify-center gap-3">{items.map(link)}</div>
        {link(settings)}
      </div>
    </nav>
  );
}
