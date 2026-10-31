"use client";

import { type ReactNode, useEffect } from "react";
import { LinkTabPanel, LinkTabs } from "@/components/ui/Tabs";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { TitleTabId } from "./core";
import { scrollToTabs, TABS_ANCHOR } from "./tab-link";

/**
 * The title's tabs (design-system 7.5, 8.7, 9 Title): "Episodes / Where to watch / More like this / Videos / Details"
 * in the address (`?tab=`, ui/LinkTabs), so a shared link, a reload and Back open the same one. Sticky under the header,
 * on a phone the row scrolls with faded edges and keeps the active tab in view (TTL-23). Only the open tab is drawn —
 * by the server, its code loaded with it — and its content takes the page's full width on the gutter.
 */
export function TitleTabs({ tabs, active, label, children }: { tabs: { id: TitleTabId; label: string }[]; active: TitleTabId; label: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // An older link to a tab by its hash ("#episodes" from a card's "Mark episodes") opens that tab.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on arrival
  useEffect(() => {
    const id = window.location.hash.slice(1) as TitleTabId;
    if (!tabs.some((t) => t.id === id)) return;
    if (id !== active) router.replace(`${pathname}?tab=${id}`, { scroll: false });
    scrollToTabs();
  }, []);
  return (
    <div id={TABS_ANCHOR} className="scroll-mt-(--header-h)">
      <LinkTabs
        sticky
        className="page-x top-(--header-h)"
        label={label}
        panelId="title-tab"
        activeId={active}
        tabs={tabs.map((t) => ({ id: t.id, href: `${pathname}?tab=${t.id}`, label: t.label }))}
      />
      <LinkTabPanel panelId="title-tab" activeId={active} className="mx-auto max-w-media pt-8 pb-10 md:pt-10">
        {children}
      </LinkTabPanel>
    </div>
  );
}
