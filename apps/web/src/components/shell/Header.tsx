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

/** The sections, the same for everyone and on every device (the TV shell's menu has them in this order too). */
const NAV = [
  { href: "/", key: "home" },
  { href: "/browse/movie", key: "movies" },
  { href: "/browse/tv", key: "series" },
  { href: "/anime", key: "anime" },
  { href: "/library", key: "library" },
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
 * The header (design-system 7.19): 64 high on the page gutter, three zones — the logo at the start, the sections in the
 * middle as plain words (the one in view in --text-1, the others in --text-2: not pills, which are the buttons' and the
 * filters' shape), search and the account at the end. From md to lg the logo is its mark alone, so the five sections
 * fit in every language. On a phone: the logo and the account only (the sections and search are the bottom bar's tabs),
 * and the header scrolls away with the page — the bar stays; in a home-screen app it stays too, as it carries Back.
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
  const library = useSignInLinks("/library").signIn;
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

  // Sections that still don't fit (a narrow window, a long language and a kids profile's tag together) scroll; while
  // more of them is past the end edge, that edge fades (as a shelf's). Search and the account keep their place.
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
  // A list is part of the library, as on the bottom bar.
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/library" && pathname.startsWith("/lists"));
  // While the API is down the visitor may well be signed in (SH-03): "Sign in" isn't offered then.
  const guest = !me && !apiDown;

  return (
    <header
      className={cn(
        // Under a home-screen app's status bar (iOS) the header starts below it, its colour behind it. A phone's scrolls
        // away in a browser (the bottom bar is the way around); from md, and in a home-screen app, it stays.
        "relative top-0 z-header h-(--header-h) pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-base ease-base standalone:sticky md:sticky",
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
      {/* From md three columns: the sections stay in the middle of the bar while both sides fit, and give way (scroll)
          before the logo or the account would leave the screen. A phone has the two ends only. */}
      <div className="page-x mx-auto flex h-full max-w-media items-center justify-between gap-4 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] lg:gap-6">
        <div className="flex items-center gap-1">
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
            <Wordmark compact />
          </Link>
        </div>
        <nav
          aria-label={t("mainMenu")}
          // Under the header's open search where it reaches them (HeaderSearchPanel): faded out, and back as it closes.
          className="min-w-0 transition-opacity duration-base ease-base in-data-[search-over]:pointer-events-none in-data-[search-over]:opacity-0 max-md:hidden"
        >
          <ul
            ref={navList}
            style={{ maskImage: navFade, WebkitMaskImage: navFade }}
            className="scroll-row -my-1 flex items-center gap-1 overflow-x-auto py-1"
          >
            {/* Anime only while the profile has it on (8.14). */}
            {NAV.filter((n) => n.key !== "anime" || showsAnime(me)).map((n) => {
              const on = active(n.href);
              return (
                <li key={n.href}>
                  <Link
                    // A guest's library is behind sign-in, which brings them back to it.
                    href={n.key === "library" && guest ? library : n.href}
                    aria-current={on ? "page" : undefined}
                    // The section in view in the text's own colour, the others a step quieter (two on light, where
                    // --text-2 is nearly as dark); one weight, so nothing moves as the section changes.
                    className={cn(
                      "flex h-9 items-center whitespace-nowrap rounded-sm px-2 text-body font-semibold transition-colors duration-fast ease-fast lg:px-3",
                      on ? "text-text-1" : "text-text-2 hover:text-text-1 in-data-[theme=light]:text-text-3 in-data-[theme=light]:hover:text-text-1",
                    )}
                  >
                    {t(n.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center justify-end gap-2 lg:gap-3">
          {/* A round search button that opens its field and results right here (HeaderSearch); not on the search page. */}
          {!pathname.startsWith("/search") && <HeaderSearch />}
          {me ? (
            <AccountMenu />
          ) : (
            <>
              {/* Language and theme for whoever isn't signed in, on a desktop and a phone (SH-07). */}
              <PrefsMenu />
              {guest && (
                // Where a signed-in visitor has the avatar; a quiet pill, so the page's own main button stays the one.
                <Link href={signIn} className={buttonClass("secondary", "sm")}>
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
