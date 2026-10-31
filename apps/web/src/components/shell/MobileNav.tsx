"use client";

import { Home, LayoutGrid, Library, LogIn, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { Link, usePathname } from "@/i18n/navigation";
import { useSession } from "../providers/Providers";
import { useSignInLinks } from "./GuestGate";

/**
 * The bottom tab bar of a phone (< md, design-system 7.19 and 1.3): Home · Catalog · Search · Library, and "Sign in"
 * for a guest in place of the library. The catalog's sections (Movies / Series / Anime) are a switch at the top of the
 * catalog. An opaque --bg, so the labels read over the stage of a hero in either theme (≥ 4.5:1, audit M1); the
 * iOS home indicator's safe area is below it, and the shell leaves room for both (Shell).
 */
export function MobileNav() {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const { me, apiDown } = useSession();
  const signIn = useSignInLinks().signIn;
  const items = [
    { href: "/", icon: Home, label: t("home"), on: pathname === "/" },
    {
      href: "/browse/movie",
      icon: LayoutGrid,
      label: ts("catalog"),
      on: pathname.startsWith("/browse") || pathname.startsWith("/anime"),
    },
    { href: "/search", icon: Search, label: t("search"), on: pathname.startsWith("/search") },
    // While the API is down the visitor may well be signed in (SH-03): no "Sign in" then.
    me || apiDown
      ? { href: "/library", icon: Library, label: t("library"), on: pathname.startsWith("/library") || pathname.startsWith("/lists") }
      : { href: signIn, icon: LogIn, label: tc("signIn"), on: false },
  ];
  return (
    <nav
      aria-label={t("mainMenu")}
      className="fixed inset-x-0 bottom-0 z-header border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-16 grid-cols-4">
        {items.map((i) => (
          <li key={i.label}>
            <Link
              href={i.href}
              aria-current={i.on ? "page" : undefined}
              className={cn(
                "flex h-full flex-col items-center justify-center gap-1 text-caption focus-visible:-outline-offset-4",
                i.on ? "text-text-1" : "text-text-3",
              )}
            >
              {/* Active: the lime icon in the dark theme, a filled one in the text colour in the light theme (7.19). */}
              <i.icon
                aria-hidden
                strokeWidth={i.on ? 2.25 : 1.75}
                className={cn("size-6", i.on && "text-accent in-data-[theme=light]:fill-current in-data-[theme=light]:text-text-1")}
              />
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
