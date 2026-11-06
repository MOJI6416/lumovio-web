"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { toast } from "@/components/ui/Toast";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { showsAnime } from "@/lib/show-anime";
import { useSession } from "../providers/Providers";
import { AccountMenu, SIGNED_OUT_KEY } from "./AccountMenu";
import { useSignInLinks } from "./GuestGate";
import { HeaderSearch } from "./HeaderSearch";
import { useNavigationLoading } from "./NavigationLoading";
import { PrefsMenu } from "./PrefsMenu";
import { Wordmark } from "./Wordmark";

const NAV = [
  { href: "/", key: "home" },
  { href: "/browse/movie", key: "movies" },
  { href: "/browse/tv", key: "series" },
  { href: "/anime", key: "anime" },
  { href: "/library", key: "library", account: true },
] as const;

/** After "Sign out" the page reloads; the next page says it happened (SH-09). */
function useSignedOutNotice() {
  const t = useTranslations("shell");
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SIGNED_OUT_KEY) !== "1") return;
      sessionStorage.removeItem(SIGNED_OUT_KEY);
    } catch {
      return;
    }
    toast.success(t("signedOut"));
  }, [t]);
}

/** The tab bar's and the header's sections: their roots show no Back in a home-screen app (7.19). */
const ROOTS = new Set(["/", "/browse/movie", "/browse/tv", "/anime", "/search", "/library"]);

/**
 * The header (design-system 7.19): 64 high on the page gutter, so the logo starts where the page does (5.3).
 * From `md`: logo, the sections, a search field that opens the search page, the account. On a phone: logo and
 * account only (search and the sections are tabs of the bottom bar). The account's avatar stands on the end edge, as the
 * logo on the start one; without an account there are "Language and theme" and "Sign in" instead.
 *
 * Over a page's artwork (`data-hero`: a billboard, a title's hero, a system page's stage) it is transparent on a scrim
 * and takes the stage's dark values; after scrolling, or on a page without artwork, it is --bg 94 % + blur + a line —
 * the same on every page (SH-06). `overlay` is the route's guess for the first paint; the page confirms it.
 */
export function Header({ overlay }: { overlay: boolean }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const router = useRouter();
  const { me, apiDown } = useSession();
  const pathname = usePathname();
  const signIn = useSignInLinks().signIn;
  const [hero, setHero] = useState(overlay);
  const [scrolled, setScrolled] = useState(false);
  useSignedOutNotice();

  useEffect(() => {
    const main = document.getElementById("main");
    const look = () => setHero(Boolean(main?.querySelector("[data-hero]")));
    look();
    // A streamed page may bring its artwork a moment later.
    const mo = main ? new MutationObserver(look) : null;
    mo?.observe(main!, { childList: true, subtree: true });
    const stop = setTimeout(() => mo?.disconnect(), 3000);
    const check = () => setScrolled(window.scrollY > 24);
    check();
    // While the page scrolls, the cards passing under a still pointer don't take hover one after another (globals.css:
    // each rise, ring and shelf arrow re-rendered the frame — half the frame rate on a slow computer).
    const root = document.documentElement;
    let still: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      check();
      if (!("scrolling" in root.dataset)) root.dataset.scrolling = "";
      clearTimeout(still);
      still = setTimeout(() => delete root.dataset.scrolling, 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      mo?.disconnect();
      clearTimeout(stop);
      clearTimeout(still);
      delete root.dataset.scrolling;
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Sections that don't fit (768–1023) scroll; while more of them is past the end edge, that edge fades (as a shelf's).
  const navList = useRef<HTMLUListElement>(null);
  const [navCut, setNavCut] = useState(false);
  useEffect(() => {
    const el = navList.current;
    if (!el) return;
    const check = () => setNavCut(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, []);
  const navFade = navCut ? "linear-gradient(to right, black calc(100% - 2rem), transparent)" : undefined;

  // While another page loads in this one's place (NavigationLoading), the old page's artwork is gone from under it.
  const loading = useNavigationLoading();
  const clear = hero && !scrolled && !loading;
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  // While the API is down the visitor may well be signed in (SH-03): their sections stay, "Sign in" isn't offered.
  const account = Boolean(me) || apiDown;

  return (
    <header
      className={cn(
        // Under a home-screen app's status bar (iOS) the header starts below it, its colour behind it.
        "sticky top-0 z-header h-(--header-h) pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-base ease-base",
        clear
          ? "stage bg-linear-to-b from-stage/80 to-transparent"
          : "bg-bg/94 shadow-[0_1px_0_var(--line)] backdrop-blur-xl in-data-[tv=1]:bg-bg in-data-[tv=1]:backdrop-blur-none",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-popover focus:rounded-sm focus:bg-text-1 focus:px-3 focus:py-2 focus:text-bg"
      >
        {tc("skipToContent")}
      </a>
      <div className="page-x mx-auto flex h-full max-w-media items-center gap-4 lg:gap-8">
        <div className="flex shrink-0 items-center gap-1">
          {/* A home-screen app has no browser Back (7.19): where it came from, else the home page; not on a tab's root. */}
          {!ROOTS.has(pathname) && (
            <IconButton
              icon={ArrowLeft}
              label={tc("back")}
              className="-ms-2 hidden standalone:inline-grid [&_svg]:rtl:-scale-x-100"
              onClick={() => {
                const nav = (window as Window & { navigation?: { canGoBack?: boolean } }).navigation;
                if (nav?.canGoBack ?? window.history.length > 1) router.back();
                else router.push("/");
              }}
            />
          )}
          <Link href="/" className="flex h-11 items-center rounded-xs text-text-1" aria-label={`Lumovio — ${t("home")}`}>
            <Wordmark />
          </Link>
        </div>
        {/* From md to lg the sections are as wide as the header allows: when they don't fit (a kids profile's tag, a
            longer language) they scroll sideways instead of pushing the search and the account off the screen. */}
        <nav aria-label={t("mainMenu")} className="min-w-0 max-md:hidden">
          <ul
            ref={navList}
            style={{ maskImage: navFade, WebkitMaskImage: navFade }}
            className="scroll-row -my-1 flex items-center gap-1 overflow-x-auto py-1 lg:gap-2"
          >
            {/* Anime only while the profile has it on (8.14). */}
            {NAV.filter((n) => (!("account" in n) || account) && (n.key !== "anime" || showsAnime(me))).map((n) => {
              const on = active(n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={on ? "page" : undefined}
                    // The active section is a pill on a light fill (redesign-2026-11.md 4); the rest are its text.
                    className={cn(
                      "flex h-9 items-center whitespace-nowrap rounded-full px-3 text-body font-medium transition-colors duration-fast ease-fast lg:px-3.5",
                      on ? "bg-text-1/14 text-text-1" : "text-text-2 hover:bg-text-1/8 hover:text-text-1",
                    )}
                  >
                    {t(n.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ms-auto flex shrink-0 items-center gap-2 lg:gap-3">
          {/* A round search button that opens its field and results right here (HeaderSearch); not on the search page. */}
          {!pathname.startsWith("/search") && <HeaderSearch />}
          {me ? (
            <AccountMenu />
          ) : (
            <>
              {/* Language and theme for whoever isn't signed in, on a desktop and a phone (SH-07). */}
              <PrefsMenu />
              {!account && (
                // A phone has "Sign in" as a tab of the bottom bar.
                <Link href={signIn} className={buttonClass("primary", "sm", "max-md:hidden")}>
                  {tc("signIn")}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
