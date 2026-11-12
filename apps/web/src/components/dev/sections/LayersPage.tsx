"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsRow, SettingsSection } from "@/components/ui/Settings";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";
import { ApiRequestError } from "@/lib/api";
import { useAction, useSettingsSave } from "@/lib/use-action";
import { Demo, ShowcaseSection } from "./parts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A request of the showcase: 500 ms, then success — or a network error while `fail` is on. */
const fakeRequest = (fail: boolean) => async () => {
  await wait(500);
  if (fail) throw new ApiRequestError(0, "network", "Network error");
};

function PageHeaderDemo() {
  const t = useTranslations("devUi");
  const pressed = (label: string) => () => toast.info(t("demoPressed", { label }));
  return (
    <Demo title={t("pageHeaderDemo")} note={t("pageHeaderNote")} className="block">
      <div className="rounded-md border border-line px-4 md:px-6">
        <PageHeader
          back={{ href: "/settings/connections", label: t("phBack") }}
          title={t("phTitle")}
          description={t("phDescription")}
          actions={
            <>
              <Button onClick={pressed(t("phAction"))}>{t("phAction")}</Button>
              <Button variant="secondary" icon={RefreshCw} onClick={pressed(t("phRefresh"))}>
                {t("phRefresh")}
              </Button>
            </>
          }
        />
      </div>
      {/* `back.below: "lg"` (Settings: the menu is beside the page from lg) and `size="display"`. */}
      <div className="mt-4 rounded-md border border-line px-4 md:px-6">
        <PageHeader size="display" back={{ href: "/settings", label: t("phBack"), below: "lg" }} title={t("phTitle")} />
      </div>
    </Demo>
  );
}

function SettingsDemo() {
  const t = useTranslations("devUi");
  const { state, save } = useSettingsSave();
  const [autoplay, setAutoplay] = useState(true);
  const [spoilers, setSpoilers] = useState(false);
  const [fail, setFail] = useState(false);
  // Read when a request (or its Retry) runs, so turning the failure off makes Retry succeed.
  const failRef = useRef(fail);
  useEffect(() => {
    failRef.current = fail;
  }, [fail]);
  // Applies at once; rolled back if the (fake) request fails.
  const toggle = (set: (v: boolean) => void, next: boolean) =>
    void save(
      () => fakeRequest(failRef.current)(),
      () => {
        set(next);
        return () => set(!next);
      },
    );
  return (
    <Demo title={t("settingsDemo")} note={t("settingsNote")} className="block">
      <div className="flex max-w-3xl flex-col gap-6">
        <SettingsSection title={t("setSection")} description={t("setSectionDesc")} save={state}>
          <SettingsRow label={t("setAutoplay")} description={t("setAutoplayDesc")}>
            <Switch
              hideLabel
              label={t("setAutoplay")}
              checked={autoplay}
              onCheckedChange={(v) => toggle(setAutoplay, v)}
            />
          </SettingsRow>
          <SettingsRow label={t("setSpoilers")} description={t("setSpoilersDesc")}>
            <Switch
              hideLabel
              label={t("setSpoilers")}
              checked={spoilers}
              onCheckedChange={(v) => toggle(setSpoilers, v)}
            />
          </SettingsRow>
        </SettingsSection>
        <SettingsSection title={t("setDemoControls")}>
          <SettingsRow label={t("setFail")} description={t("setFailDesc")}>
            <Switch hideLabel label={t("setFail")} checked={fail} onCheckedChange={setFail} />
          </SettingsRow>
        </SettingsSection>
      </div>
    </Demo>
  );
}

function ActionDemo() {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  const all = [t("demoTitle1"), t("demoTitle2"), t("demoTitle3")];
  const [list, setList] = useState(all);
  const [fail, setFail] = useState(false);
  const remove = useAction({
    run: (_title: string) => fakeRequest(fail)(),
    optimistic: (title: string) => {
      setList((l) => l.filter((x) => x !== title));
      return () => setList((l) => (l.includes(title) ? l : all.filter((x) => x === title || l.includes(x))));
    },
    success: (_, title) => t("actionRemoved", { title }),
    undo: () => wait(400),
    error: (_, title) => t("actionRemoveFailed", { title }),
  });
  return (
    <Demo title={t("actionDemo")} note={t("actionNote")} className="block">
      <div className="flex max-w-xl flex-col gap-4">
        <Switch label={t("actionFail")} checked={fail} onCheckedChange={setFail} />
        <ul className="divide-y divide-line rounded-md border border-line bg-surface-1 px-4">
          {list.map((title) => (
            <li key={title} className="flex min-h-14 items-center justify-between gap-4">
              <span className="text-title">{title}</span>
              <Button
                variant="tertiary"
                size="sm"
                aria-label={t("actionRemove", { title })}
                onClick={() => void remove.run(title)}
              >
                {tc("remove")}
              </Button>
            </li>
          ))}
          {list.length === 0 && <li className="py-4 text-body-s text-text-2">{t("actionEmpty")}</li>}
        </ul>
        <Button
          variant="secondary"
          className="w-fit"
          disabled={list.length === all.length}
          onClick={() => setList(all)}
        >
          {t("actionReset")}
        </Button>
      </div>
    </Demo>
  );
}

export function LayersPage() {
  const t = useTranslations("devUi");
  return (
    <>
      <ShowcaseSection id="page-header" title={t("pageHeader")} source="ui/PageHeader.tsx">
        <PageHeaderDemo />
      </ShowcaseSection>
      <ShowcaseSection
        id="settings"
        title={t("settingsParts")}
        source="ui/Settings.tsx, lib/use-action.ts"
      >
        <SettingsDemo />
      </ShowcaseSection>
      <ShowcaseSection id="use-action" title={t("useAction")} source="lib/use-action.ts, lib/action.ts">
        <ActionDemo />
      </ShowcaseSection>
    </>
  );
}
