"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LinkTabPanel, LinkTabs, PillTabs, Tab, TabList, TabPanel, Tabs } from "@/components/ui/Tabs";
import { Demo, ShowcaseSection } from "./parts";

function useTitleTabs() {
  const t = useTranslations("title");
  return [
    { id: "where", label: t("watchOptions") },
    { id: "episodes", label: t("episodesTitle"), count: 8 },
    { id: "similar", label: t("related") },
    { id: "videos", label: t("trailers") },
    { id: "details", label: t("details") },
  ];
}

function StateTabs({ narrow }: { narrow?: boolean }) {
  const t = useTranslations("devUi");
  const tabs = useTitleTabs();
  return (
    <div className={narrow ? "w-full max-w-xs" : "w-full"}>
      <Tabs defaultValue={narrow ? "videos" : "where"}>
        <TabList label={t("tabsLabel")}>
          {tabs.map((x) => (
            <Tab key={x.id} value={x.id} count={x.count}>
              {x.label}
            </Tab>
          ))}
        </TabList>
        {tabs.map((x) => (
          <TabPanel key={x.id} value={x.id} className="py-4 text-body text-text-2">
            {t("tabPanel", { tab: x.label })}
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}

function UrlTabs() {
  const t = useTranslations();
  const params = useSearchParams();
  const tabs = [
    { id: "watchlist", label: t("library.watchlist"), count: 42 },
    { id: "watched", label: t("title.watched"), count: 318 },
    { id: "favorites", label: t("library.favorites") },
    { id: "lists", label: t("library.lists"), count: 3 },
  ].map((x) => ({ ...x, href: { pathname: "/dev/ui", query: { tab: x.id } } }));
  const active = tabs.find((x) => x.id === params.get("tab"))?.id ?? tabs[0]!.id;
  const label = tabs.find((x) => x.id === active)!.label;
  return (
    <div className="w-full">
      <LinkTabs tabs={tabs} activeId={active} label={t("devUi.linkTabsLabel")} panelId="showcase-url-tabs" />
      <LinkTabPanel panelId="showcase-url-tabs" activeId={active} className="py-4 text-body text-text-2">
        {t("devUi.tabPanel", { tab: label })}
      </LinkTabPanel>
    </div>
  );
}

/** The seasons of a long series as pill tabs, in a narrow box so the row scrolls. */
function Seasons() {
  const t = useTranslations();
  const [season, setSeason] = useState("9");
  const tabs = [...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t("title.seasonPill", { n: i + 1 }) })), { value: "0", label: t("title.specials") }];
  return (
    <div className="w-full max-w-md">
      <PillTabs tabs={tabs} value={season} onValueChange={setSeason} label={t("title.seasons")} panelId="showcase-seasons" />
      <div id="showcase-seasons" role="tabpanel" className="py-4 text-body text-text-2">
        {t("devUi.tabPanel", { tab: tabs.find((x) => x.value === season)!.label })}
      </div>
    </div>
  );
}

function Segmented() {
  const t = useTranslations();
  const [mode, setMode] = useState<"titles" | "ai">("titles");
  const [quality, setQuality] = useState<"auto" | "best" | "small">("auto");
  const [year, setYear] = useState("2026");
  return (
    <ShowcaseSection id="segmented" title={t("devUi.segmented")} source="ui/SegmentedControl.tsx">
      <Demo title="2" note={t("devUi.segmentedNote")}>
        <SegmentedControl
          label={t("devUi.segSearchMode")}
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "titles", label: t("search.titles") },
            { value: "ai", label: t("search.aiToggle") },
          ]}
        />
      </Demo>
      <Demo title="3">
        <SegmentedControl
          label={t("devUi.selectQuality")}
          value={quality}
          onValueChange={setQuality}
          options={[
            { value: "auto", label: t("title.tsQuality_auto") },
            { value: "best", label: t("title.tsQuality_best") },
            { value: "small", label: t("title.tsQuality_small") },
          ]}
        />
      </Demo>
      <Demo title={`4 · ${t("devUi.stateDisabled")} 2023`}>
        <SegmentedControl
          label={t("devUi.segYear")}
          value={year}
          onValueChange={setYear}
          options={["2023", "2024", "2025", "2026"].map((y) => ({ value: y, label: y, disabled: y === "2023" }))}
        />
      </Demo>
    </ShowcaseSection>
  );
}

export function ControlsNavigation() {
  const t = useTranslations("devUi");
  return (
    <>
      <ShowcaseSection id="tabs" title={t("tabs")} source="ui/Tabs.tsx">
        <Demo title="Tabs" note={t("tabsNote")} className="block">
          <StateTabs />
        </Demo>
        <Demo title="Tabs · 320" note={t("tabsNarrowNote")} className="block">
          <StateTabs narrow />
        </Demo>
        <Demo title="LinkTabs" note={t("linkTabsNote")} className="block">
          <UrlTabs />
        </Demo>
        <Demo title="PillTabs" note={t("pillTabsNote")} className="block">
          <Seasons />
        </Demo>
      </ShowcaseSection>
      <Segmented />
    </>
  );
}
