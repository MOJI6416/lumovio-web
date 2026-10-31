"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Checkbox, RadioGroup } from "@/components/ui/Checkbox";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import { Art, Cell, Demo, ShowcaseSection } from "./parts";

const KINDS = ["kind_watch", "kind_rating", "kind_watchlist"] as const;

/** "1:02:10" */
const clock = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n, i) => (i ? String(n).padStart(2, "0") : n)).join(":");

function Toggles() {
  const t = useTranslations();
  const [autoplay, setAutoplay] = useState(true);
  const [spoilers, setSpoilers] = useState(false);
  const [kinds, setKinds] = useState<Set<string>>(new Set(["kind_watch"]));
  const [quality, setQuality] = useState<"auto" | "best" | "small">("auto");
  const all = KINDS.every((k) => kinds.has(k));
  const some = !all && KINDS.some((k) => kinds.has(k));
  return (
    <ShowcaseSection id="toggles" title={t("devUi.toggles")} source="ui/Switch.tsx · ui/Checkbox.tsx · 7.7">
      <Demo title="Switch" note={t("devUi.switchNote")} className="block">
        <div className="flex max-w-xl flex-col divide-y divide-line">
          <Switch
            checked={autoplay}
            onCheckedChange={setAutoplay}
            label={t("devUi.switchAutoplay")}
            description={t("devUi.switchAutoplayHint")}
          />
          <Switch checked={spoilers} onCheckedChange={setSpoilers} label={t("devUi.switchSpoilers")} />
          <Switch checked disabled label={`${t("devUi.switchAutoplay")} · ${t("devUi.stateDisabled")}`} />
          <Switch checked={false} disabled label={`${t("devUi.switchSpoilers")} · ${t("devUi.stateDisabled")}`} />
        </div>
        <div className="mt-4 flex items-center gap-6">
          <Cell label="hideLabel">
            <Switch hideLabel checked={autoplay} onCheckedChange={setAutoplay} label={t("devUi.switchAutoplay")} />
          </Cell>
        </div>
      </Demo>
      <Demo title="Checkbox" className="block">
        <fieldset className="flex max-w-xl flex-col">
          <legend className="mb-2 text-body-s font-semibold text-text-1">{t("devUi.importWhat")}</legend>
          <Checkbox
            checked={all}
            indeterminate={some}
            onCheckedChange={(v) => setKinds(new Set(v ? KINDS : []))}
            label={t("devUi.selectAll")}
          />
          <div className="ps-8">
            {KINDS.map((k) => (
              <Checkbox
                key={k}
                checked={kinds.has(k)}
                onCheckedChange={(v) =>
                  setKinds((s) => {
                    const n = new Set(s);
                    if (v) n.add(k);
                    else n.delete(k);
                    return n;
                  })
                }
                label={t(`import.${k}`)}
              />
            ))}
            <Checkbox
              checked={false}
              onCheckedChange={() => {}}
              disabled
              label={t("import.kind_favorite")}
              description={t("devUi.checkboxDisabledHint")}
            />
          </div>
        </fieldset>
        <div className="mt-4 flex items-center gap-6">
          <Cell label="hideLabel">
            <Checkbox hideLabel checked={all} indeterminate={some} onCheckedChange={(v) => setKinds(new Set(v ? KINDS : []))} label={t("devUi.selectAll")} />
          </Cell>
        </div>
      </Demo>
      <Demo title="RadioGroup" className="block">
        <RadioGroup
          className="max-w-xl"
          legend={t("devUi.selectQuality")}
          value={quality}
          onValueChange={setQuality}
          options={[
            { value: "auto", label: t("title.tsQuality_auto"), description: t("devUi.qualityAutoHint") },
            { value: "best", label: t("title.tsQuality_best"), description: t("devUi.qualityBestHint") },
            { value: "small", label: t("title.tsQuality_small"), description: t("devUi.qualitySmallHint") },
          ]}
        />
      </Demo>
    </ShowcaseSection>
  );
}

function Sliders() {
  const t = useTranslations();
  const [volume, setVolume] = useState(40);
  const [time, setTime] = useState(3730);
  const total = 9300;
  return (
    <ShowcaseSection id="slider" title={t("devUi.slider")} source="ui/Slider.tsx · 7.7">
      <Demo title="default" className="block">
        <div className="flex max-w-md flex-col gap-6">
          <Cell label={`${t("common.volume")} · ${t("devUi.percent", { value: volume })}`}>
            <Slider value={volume} onValueChange={setVolume} label={t("common.volume")} valueText={t("devUi.percent", { value: volume })} />
          </Cell>
          <Cell label={t("devUi.stateDisabled")}>
            <Slider value={70} onValueChange={() => {}} label={t("common.volume")} disabled />
          </Cell>
        </div>
      </Demo>
      <Demo title="player" note={t("devUi.sliderPlayerNote")} className="block">
        <Art className="max-w-3xl">
          <div className="flex w-full flex-col gap-2">
            <Slider
              variant="player"
              value={time}
              onValueChange={setTime}
              max={total}
              label={t("common.seek")}
              valueText={t("devUi.timeOf", { current: clock(time), total: clock(total) })}
            />
            <span className="text-body-s text-text-2 tabular-nums">
              {clock(time)} / {clock(total)}
            </span>
          </div>
        </Art>
      </Demo>
    </ShowcaseSection>
  );
}

export function ControlsToggles() {
  return (
    <>
      <Toggles />
      <Sliders />
    </>
  );
}
