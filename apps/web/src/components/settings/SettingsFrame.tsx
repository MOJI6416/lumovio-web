"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";
import { BrandLoader } from "@/components/ui/BrandMotion";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePathname } from "@/i18n/navigation";
import { useSectionLoading } from "@/components/shell/NavigationLoading";
import { inSection, SettingsNav, useSettingsSections } from "./SettingsNav";

/** The settings menu sticks at lg:top-24 (SettingsNav): 6rem under the viewport's top. */
const MENU_TOP_REM = 6;

/**
 * The Settings template (design-system 9, 10.1–10.2): h1 "Settings" → the menu (on the left from lg, 240) → the open
 * section (up to 880), all within the tool width, centred on the page (owner, 2026-10-25). Below lg /settings is the list of
 * sections and a section is a page of its own: "← Settings" over the section's name as the h1 (SET-03). One h1 either
 * way — its words follow the width. A page under a section (a server's torrents) is a Tool page with its own header.
 */
export function SettingsFrame({ kids, children }: { kids: boolean; children: ReactNode }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const all = useSettingsSections();
  const sections = kids ? all.filter((s) => s.kidsToo) : all;
  const content = useRef<HTMLDivElement>(null);
  // Another section is being prepared (desktop, the menu beside it): the loader in the section's place, the menu and
  // the page where they are (owner, 2026-11-06: the page jumped and nothing said it was loading).
  const loading = useSectionLoading("/settings");
  // The new section starts right under the menu, which stays put: the page doesn't jump to its top (the menu would
  // slide down by the heading's height). Only when the page is scrolled past the section's start.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on each new section
  useEffect(() => {
    const el = content.current;
    if (!el || !window.matchMedia("(min-width: 64rem)").matches) return;
    const menuTop = MENU_TOP_REM * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const start = el.getBoundingClientRect().top + window.scrollY - menuTop;
    if (window.scrollY > start) window.scrollTo({ top: start, behavior: "instant" });
  }, [pathname]);
  if (pathname.split("/").filter(Boolean).length > 2) return <div className="mx-auto max-w-tool pb-10">{children}</div>;

  const index = pathname === "/settings";
  const section = index ? undefined : all.find((s) => inSection(s, pathname));
  return (
    <div className="mx-auto max-w-tool">
      <PageHeader
        // "← Settings" only where the menu isn't beside the section (below lg).
        back={section && { href: "/settings", label: t("title"), below: "lg" }}
        title={
          section ? (
            <>
              <span className="max-lg:hidden">{t("title")}</span>
              <span className="lg:hidden">{section.label}</span>
            </>
          ) : (
            t("title")
          )
        }
      />
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,55rem)] lg:gap-10">
        <SettingsNav sections={sections} pathname={pathname} index={index} />
        {/* Below lg the list of sections is the whole of /settings; the desktop shows Profile there. */}
        <div ref={content} aria-busy={loading || undefined} className={cn("relative min-w-0 pb-10", index && "max-lg:hidden")}>
          <div className={cn("transition-opacity duration-base ease-base", loading && "opacity-30")}>{children}</div>
          {loading && (
            <div role="status" aria-label={tc("loading")} className="absolute inset-x-0 top-0 grid animate-fade-in justify-center pt-24">
              <BrandLoader size="md" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
