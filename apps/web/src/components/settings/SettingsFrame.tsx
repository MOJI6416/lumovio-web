"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";
import { useSectionLoading } from "@/components/shell/NavigationLoading";
import { BrandLoader } from "@/components/ui/BrandMotion";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePathname } from "@/i18n/navigation";
import { inSection, SettingsNav, useSettingsSections } from "./SettingsNav";

/**
 * The Settings template (design-system 9): on a desktop (lg) the menu on the left (256) and the open section beside it
 * (up to 720) — both centred on the page as one block (owner, 2026-10-25) — with the section's name as the page's h1
 * over it, in line with the profile's card at the top of the menu. Below lg /settings is the list of sections ("Settings"
 * as the h1) and a section is a page of its own: "← Settings" over the section's name (SET-03). One h1 either way: the
 * header comes first in the DOM, so a phone reads it before the list; the desktop's grid puts it over the section. A page
 * under a section (a server's torrents) is a Tool page with its own header.
 */
export function SettingsFrame({ kids, children }: { kids: boolean; children: ReactNode }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const all = useSettingsSections();
  const sections = kids ? all.filter((s) => s.kidsToo) : all;
  const frame = useRef<HTMLDivElement>(null);
  // Another section is being prepared (desktop, the menu beside it): the loader in the section's place, the menu and
  // the page where they are (owner, 2026-11-06: the page jumped and nothing said it was loading).
  const loading = useSectionLoading("/settings");
  // The new section starts right under the menu, which stays put: the page doesn't jump to its top. Only when the page
  // is scrolled past the frame's start.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on each new section
  useEffect(() => {
    const el = frame.current;
    const menu = el?.querySelector("nav");
    if (!el || !menu || !window.matchMedia("(min-width: 64rem)").matches) return;
    // The menu sticks right under the site's header (SettingsNav, top: --header-h), where the frame begins.
    const start = el.getBoundingClientRect().top + window.scrollY - Number.parseFloat(getComputedStyle(menu).top);
    if (window.scrollY > start) window.scrollTo({ top: start, behavior: "instant" });
  }, [pathname]);
  if (pathname.split("/").filter(Boolean).length > 2) return <div className="mx-auto max-w-tool pb-10">{children}</div>;

  const index = pathname === "/settings";
  const section = index ? undefined : all.find((s) => inSection(s, pathname));
  const profile = all[0]!.label;
  return (
    // Rows: the header, then the section taking what the menu's height adds (a short section doesn't push its h1 away).
    <div ref={frame} className="mx-auto max-w-5xl lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12">
      <PageHeader
        className="lg:col-start-2 lg:row-start-1"
        // "← Settings" only where the menu isn't beside the section (below lg).
        back={section && { href: "/settings", label: t("title"), below: "lg" }}
        title={
          section ? (
            section.label
          ) : (
            // /settings: the list of sections below lg, the Profile section beside the menu on a desktop.
            <>
              <span className="lg:hidden">{t("title")}</span>
              <span className="max-lg:hidden">{profile}</span>
            </>
          )
        }
      />
      <SettingsNav
        sections={sections}
        pathname={pathname}
        index={index}
        className="pb-10 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:pt-8"
      />
      {/* Below lg the list of sections is the whole of /settings; the desktop shows Profile there. */}
      <div aria-busy={loading || undefined} className={cn("relative min-w-0 pb-10 lg:col-start-2 lg:row-start-2", index && "max-lg:hidden")}>
        <div className={cn("transition-opacity duration-base ease-base", loading && "opacity-30")}>{children}</div>
        {loading && (
          <div role="status" aria-label={tc("loading")} className="absolute inset-x-0 top-0 grid animate-fade-in justify-center pt-24">
            <BrandLoader size="md" />
          </div>
        )}
      </div>
    </div>
  );
}
