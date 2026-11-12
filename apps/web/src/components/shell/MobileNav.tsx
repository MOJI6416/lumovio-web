"use client";

import { Home, LayoutGrid, Library, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { Link, usePathname } from "@/i18n/navigation";
import { showsAnime } from "@/lib/show-anime";
import { useSession } from "../providers/Providers";
import { useSignInLinks } from "./GuestGate";

/** The catalog's sections: the Catalog tab opens the one last seen on this device (as an app's tab keeps its place). */
const SECTIONS = ["/browse/movie", "/browse/tv", "/anime"];
const SECTION_KEY = "lumovio:catalog-section";

function useCatalogSection(pathname: string, anime: boolean) {
  const [last, setLast] = useState("/browse/movie");
  useEffect(() => {
    try {
      if (SECTIONS.includes(pathname)) localStorage.setItem(SECTION_KEY, pathname);
      const saved = localStorage.getItem(SECTION_KEY);
      if (saved && SECTIONS.includes(saved)) setLast(saved);
    } catch {
      // No storage (private mode): the tab opens Movies.
    }
  }, [pathname]);
  return last === "/anime" && !anime ? "/browse/movie" : last;
}

/**
 * The bottom tab bar of a phone (< md): Home · Catalog · Search · Library — the same four for
 * everyone (a guest's Library is behind sign-in, which brings them back to it; "Sign in" itself is in the header). The
 * catalog's sections (Movies / Series / Anime) are a switch at the top of the catalog. A floating pill: 16 px in from
 * the sides, above the iOS home indicator; a near-opaque surface with blur, so the labels read over the stage of a hero
 * in either theme (≥ 4.5:1). The shell leaves room for it (Shell).
 */
export function MobileNav() {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  const pathname = usePathname();
  const { me, apiDown } = useSession();
  const library = useSignInLinks("/library").signIn;
  const catalog = useCatalogSection(pathname, showsAnime(me));
  const items = [
    { href: "/", icon: Home, label: t("home"), on: pathname === "/" },
    {
      href: catalog,
      icon: LayoutGrid,
      label: ts("catalog"),
      on: pathname.startsWith("/browse") || pathname.startsWith("/anime"),
    },
    { href: "/search", icon: Search, label: t("search"), on: pathname.startsWith("/search") },
    // While the API is down the visitor may well be signed in: their library, not sign-in.
    {
      href: me || apiDown ? "/library" : library,
      icon: Library,
      label: t("library"),
      on: pathname.startsWith("/library") || pathname.startsWith("/lists"),
    },
  ];
  return (
    <nav
      aria-label={t("mainMenu")}
      className="fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-header rounded-full border border-line bg-surface-2/90 shadow-float backdrop-blur-xl in-data-[theme=light]:bg-surface-1/90 md:hidden"
    >
      <ul className="grid h-16 grid-cols-4 gap-1 p-1.5">
        {items.map((i) => (
          <li key={i.label}>
            <Link
              href={i.href}
              aria-current={i.on ? "page" : undefined}
              className={cn(
                "flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-caption focus-visible:-outline-offset-4",
                i.on ? "bg-text-1/10 font-semibold text-text-1" : "text-text-3",
              )}
            >
              {/* Active: the lime icon in the dark theme, a filled one in the text colour in the light theme. */}
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
