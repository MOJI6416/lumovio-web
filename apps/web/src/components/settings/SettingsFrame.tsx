"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePathname } from "@/i18n/navigation";
import { inSection, SettingsNav, useSettingsSections } from "./SettingsNav";

/**
 * The Settings template (design-system 9, 10.1–10.2): h1 "Settings" → the menu (on the left from lg, 240) → the open
 * section (up to 880), all within the tool width, centred on the page (owner, 2026-10-25). Below lg /settings is the list of
 * sections and a section is a page of its own: "← Settings" over the section's name as the h1 (SET-03). One h1 either
 * way — its words follow the width. A page under a section (a server's torrents) is a Tool page with its own header.
 */
export function SettingsFrame({ kids, children }: { kids: boolean; children: ReactNode }) {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const all = useSettingsSections();
  const sections = kids ? all.filter((s) => s.kidsToo) : all;
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
        <div className={cn("min-w-0 pb-10", index && "max-lg:hidden")}>{children}</div>
      </div>
    </div>
  );
}
