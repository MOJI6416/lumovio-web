"use client";

import { useTranslations } from "next-intl";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ControlsSections } from "./sections/Controls";
import { LayersSections } from "./sections/Layers";

type Theme = "dark" | "light";

/** Anchors of the showcase; each components/ui primitive adds a section of its own. */
const SECTIONS = [
  "color",
  "type",
  "spacing",
  "radius",
  "shadow",
  "focus",
  "layers",
  "motion",
  "stage",
] as const;

const COLOR_GROUPS = [
  {
    id: "neutral",
    tokens: [
      "--bg",
      "--surface-1",
      "--surface-2",
      "--surface-3",
      "--line",
      "--line-2",
      "--text-1",
      "--text-2",
      "--text-3",
      "--scrim",
    ],
  },
  {
    id: "accent",
    tokens: [
      "--brand-mark",
      "--accent",
      "--accent-hover",
      "--accent-press",
      "--accent-soft",
      "--selected-bg",
      "--selected-fg",
      "--progress",
      "--focus",
      "--tab-indicator",
      "--switch-on",
      "--switch-knob-on",
      "--link",
      "--on-accent",
    ],
  },
  {
    id: "status",
    tokens: [
      "--success",
      "--success-soft",
      "--warning",
      "--warning-soft",
      "--danger",
      "--danger-soft",
      "--info",
      "--info-soft",
    ],
  },
  { id: "stage", tokens: ["--bg-stage", "--scrim-start", "--scrim-bottom"] },
  {
    id: "avatar",
    tokens: [
      "--avatar-ember",
      "--avatar-comet",
      "--avatar-nova",
      "--avatar-moss",
      "--avatar-prism",
      "--avatar-tide",
      "--avatar-aurora",
      "--avatar-lumen",
      "--avatar-orbit",
      "--avatar-dusk",
      "--avatar-bloom",
      "--avatar-coral",
    ],
  },
] as const;

const GRADIENTS = new Set<string>(["--scrim-start", "--scrim-bottom", ...COLOR_GROUPS[4].tokens]);

const TYPE = [
  ["display", "text-display"],
  ["h1", "text-h1"],
  ["h2", "text-h2"],
  ["h3", "text-h3"],
  ["title", "text-title"],
  ["body-l", "text-body-l"],
  ["body", "text-body"],
  ["body-s", "text-body-s"],
  ["caption", "text-caption"],
] as const;

const SPACE = [
  [1, "w-1"],
  [2, "w-2"],
  [3, "w-3"],
  [4, "w-4"],
  [5, "w-5"],
  [6, "w-6"],
  [8, "w-8"],
  [10, "w-10"],
  [12, "w-12"],
  [16, "w-16"],
  [20, "w-20"],
  [24, "w-24"],
] as const;

const RADII = [
  { name: "--radius-xs", className: "rounded-xs" },
  { name: "--radius-sm", className: "rounded-sm" },
  { name: "--radius-md", className: "rounded-md" },
  { name: "--radius-lg", className: "rounded-lg" },
  { name: "--radius-full", className: "rounded-full" },
  { name: "--radius-avatar", className: "rounded-avatar" },
] as const;

const LAYERS = [
  ["sticky", "z-sticky", "layerSticky"],
  ["header", "z-header", "layerHeader"],
  ["popover", "z-popover", "layerPopover"],
  ["player", "z-player", "layerPlayer"],
  ["scrim", "z-scrim", "layerScrim"],
  ["dialog", "z-dialog", "layerDialog"],
  ["toast", "z-toast", "layerToast"],
] as const;

const MOTION = [
  ["fast", "duration-fast ease-fast", "motionFast"],
  ["base", "duration-base ease-base", "motionBase"],
  ["slow", "duration-slow ease-slow", "motionSlow"],
  ["scene", "duration-scene ease-scene", "motionScene"],
] as const;

/** Reads a computed value where the element is rendered, so the theme and TV wrappers above it apply. */
function useComputed<T extends HTMLElement>(read: (s: CSSStyleDeclaration) => string) {
  const ref = useRef<T>(null);
  const [value, setValue] = useState("");
  const readRef = useRef(read);
  useEffect(() => {
    if (ref.current) setValue(readRef.current(getComputedStyle(ref.current)));
  }, []);
  return [ref, value] as const;
}

function TokenValue({ name }: { name: string }) {
  const [ref, value] = useComputed<HTMLSpanElement>((s) => s.getPropertyValue(name).trim());
  return (
    <span ref={ref} className="break-all text-body-s text-text-2 tabular-nums">
      {value}
    </span>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 border-t border-line py-10">
      <h2 id={`${id}-title`} className="mb-6 text-h2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ name, theme }: { name: string; theme: Theme }) {
  const t = useTranslations("devUi");
  const style: CSSProperties = GRADIENTS.has(name)
    ? { backgroundImage: `var(${name})` }
    : { backgroundColor: `var(${name})` };
  return (
    <td data-theme={theme} className="bg-bg p-2 align-top text-text-1 sm:p-3">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-3">
        <span aria-hidden className="size-10 shrink-0 rounded-sm border border-line-2" style={style} />
        <div className="flex min-w-0 flex-col gap-1">
          <TokenValue name={name} />
        </div>
      </div>
    </td>
  );
}

function ColorTable({ group }: { group: (typeof COLOR_GROUPS)[number] }) {
  const t = useTranslations("devUi");
  return (
    <table className="w-full max-w-5xl table-fixed border-collapse overflow-hidden rounded-sm border border-line">
      <caption className="mb-3 text-start text-h3">{t(group.id)}</caption>
      <thead>
        <tr className="text-body-s text-text-2">
          <th scope="col" className="p-3 text-start font-semibold">
            {t("role")}
          </th>
          <th scope="col" className="p-3 text-start font-semibold">
            {t("themeDark")}
          </th>
          <th scope="col" className="p-3 text-start font-semibold">
            {t("themeLight")}
          </th>
        </tr>
      </thead>
      <tbody>
        {group.tokens.map((name) => (
          <tr key={name} className="border-t border-line">
            <th scope="row" className="break-all p-3 text-start align-top text-body-s font-semibold">
              {name}
            </th>
            <Swatch name={name} theme="dark" />
            <Swatch name={name} theme="light" />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TypeRow({ name, className, sample }: { name: string; className: string; sample: string }) {
  const [ref, metrics] = useComputed<HTMLParagraphElement>(
    (s) =>
      `${s.fontSize} · ${s.fontWeight} · ${(parseFloat(s.lineHeight) / parseFloat(s.fontSize)).toFixed(2)}`,
  );
  return (
    <div className="flex flex-col gap-2 border-t border-line py-4 first:border-t-0">
      <div className="flex flex-wrap gap-x-3 text-body-s text-text-2">
        <span className="font-semibold text-text-1">{name}</span>
        <span>{className}</span>
        <span className="tabular-nums">{metrics}</span>
      </div>
      <p ref={ref} className={`${className} [font-variant-ligatures:normal]`}>
        {sample}
      </p>
    </div>
  );
}

function GutterValue() {
  const [ref, px] = useComputed<HTMLDivElement>((s) => s.paddingInlineStart);
  return (
    <div ref={ref} className="page-x rounded-sm bg-surface-2 py-3">
      <div className="rounded-xs bg-surface-1 px-3 py-2 text-body-s text-text-2">
        --gutter = <TokenValue name="--gutter" /> · {px}
      </div>
    </div>
  );
}

export function TokenShowcase({ initialTheme, siteTv }: { initialTheme: Theme; siteTv: boolean }) {
  const t = useTranslations("devUi");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [tv, setTv] = useState(siteTv);
  const [moved, setMoved] = useState(false);
  // The TV root size can't be set on a part of the page; zoom stands in for it (and undoes it when the site is a TV).
  const zoom = tv === siteTv ? undefined : tv ? "var(--tv-scale)" : "calc(1 / var(--tv-scale))";

  return (
    <div
      data-theme={theme}
      data-tv={tv ? "1" : undefined}
      style={{ zoom }}
      // Token names are code: the UI font could join "--" into a dash.
      className="min-h-dvh bg-bg pb-24 text-text-1 [font-variant-ligatures:none]"
    >
      <header className="page-x flex flex-col gap-4 pt-10 pb-6">
        <h1 className="text-h1">{t("title")}</h1>
        <p className="max-w-measure text-body text-text-2">{t("description")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">{t("theme")}</legend>
            {(["dark", "light"] as const).map((x) => (
              <Button
                key={x}
                size="md"
                variant={theme === x ? "primary" : "secondary"}
                aria-pressed={theme === x}
                onClick={() => setTheme(x)}
              >
                {t(x === "dark" ? "themeDark" : "themeLight")}
              </Button>
            ))}
          </fieldset>
          <Button
            size="md"
            variant={tv ? "primary" : "secondary"}
            aria-pressed={tv}
            onClick={() => setTv(!tv)}
          >
            {t("tv")}
          </Button>
        </div>
        <nav aria-label={t("sections")}>
          <ul className="flex flex-wrap gap-x-4">
            {SECTIONS.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-11 min-w-11 items-center text-body-s font-semibold text-text-2 hover:text-text-1 md:min-h-8 md:min-w-0"
                >
                  {t(id)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Remounted on every switch so each value is read again under the new theme and TV mode. */}
      <main key={`${theme}-${tv}`} className="page-x">
        <Section id="color" title={t("color")}>
          <div className="flex flex-col gap-8">
            {COLOR_GROUPS.map((g) => (
              <ColorTable key={g.id} group={g} />
            ))}
          </div>
        </Section>

        <Section id="type" title={t("type")}>
          {TYPE.map(([name, className]) => (
            <TypeRow key={name} name={name} className={className} sample={t("typeSample")} />
          ))}
        </Section>

        <Section id="spacing" title={t("spacing")}>
          <ul className="flex flex-col gap-2">
            {SPACE.map(([n, w]) => (
              <li key={n} className="flex items-center gap-4">
                <span className="w-16 shrink-0 text-body-s text-text-2 tabular-nums">
                  {n * 4} px · {n}
                </span>
                <span aria-hidden className={`${w} h-4 rounded-xs bg-text-3`} />
              </li>
            ))}
          </ul>
          <h3 className="mt-8 mb-3 text-h3">{t("gutter")}</h3>
          <GutterValue />
          <h3 className="mt-8 mb-3 text-h3">{t("measure")}</h3>
          <p className="max-w-measure text-body text-text-2">{t("measureSample")}</p>
          <p className="mt-2 text-body-s text-text-3">
            --measure = <TokenValue name="--measure" />
          </p>
        </Section>

        <Section id="radius" title={t("radius")}>
          <ul className="flex flex-wrap gap-6">
            {RADII.map((r) => (
              <li key={r.name} className="flex w-32 flex-col gap-2">
                <span
                  aria-hidden
                  className={`size-20 border border-line-2 bg-surface-2 ${r.className}`}
                />
                <span className="text-body-s font-semibold">{r.name}</span>
                <span className="text-body-s text-text-2">{r.className}</span>
                <TokenValue name={r.name} />
              </li>
            ))}
          </ul>
        </Section>

        <Section id="shadow" title={t("shadow")}>
          <div className="w-full max-w-sm rounded-sm bg-surface-2 p-6 shadow-float">
            <p className="text-title">--shadow-float · shadow-float</p>
            <p className="mt-2 text-body-s text-text-2">{t("shadowNote")}</p>
            <p className="mt-2">
              <TokenValue name="--shadow-float" />
            </p>
          </div>
        </Section>

        <Section id="focus" title={t("focus")}>
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex flex-col gap-4">
              <div
                className="w-fit rounded-sm bg-surface-2 px-4 py-3 text-body"
                style={{
                  outline: "var(--focus-width) solid var(--focus)",
                  outlineOffset: "var(--focus-offset)",
                }}
              >
                {t("focusRing")}
              </div>
              <ul className="flex flex-col gap-1 text-body-s text-text-2">
                {["--focus", "--focus-width", "--focus-offset", "--focus-halo"].map((n) => (
                  <li key={n}>
                    {n} = <TokenValue name={n} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="stage relative w-80 max-w-full overflow-hidden rounded-sm bg-stage">
              {/* biome-ignore lint/performance/noImgElement: a static brand image stands in for artwork */}
              <img src="/brand/og.png" alt="" className="aspect-video w-full object-cover" />
              <div
                className="absolute inset-0 flex items-end p-6"
                style={{ backgroundImage: "var(--scrim-start)" }}
              >
                <div
                  className="rounded-sm bg-surface-2 px-4 py-3 text-body"
                  style={{
                    outline: "var(--focus-width) solid var(--focus)",
                    outlineOffset: "var(--focus-offset)",
                    boxShadow: "var(--focus-halo)",
                  }}
                >
                  {t("focusOnArt")}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-6 text-body-s text-text-2">{t("focusTry")}</p>
        </Section>

        <Section id="layers" title={t("layers")}>
          <div className="flex flex-wrap items-start gap-10">
            <ul className="flex flex-col gap-2">
              {LAYERS.map(([id, className, label]) => (
                <li key={id} className="flex flex-wrap items-baseline gap-x-3 text-body-s">
                  <span className="font-semibold">{className}</span>
                  <TokenValue name={`--z-index-${id}`} />
                  <span className="text-text-2">{t(label)}</span>
                </li>
              ))}
            </ul>
            {/* Drawn lowest-first in reverse: only the z-* classes put the toast on top. */}
            <div aria-hidden className="relative h-64 w-72">
              {[...LAYERS].reverse().map(([id, className], i) => (
                <div
                  key={id}
                  className={`absolute size-32 rounded-sm border border-line-2 bg-surface-2 p-2 text-caption shadow-float ${className}`}
                  style={{
                    insetInlineStart: `${(LAYERS.length - 1 - i) * 1.5}rem`,
                    top: `${(LAYERS.length - 1 - i) * 1.25}rem`,
                  }}
                >
                  {className}
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section id="motion" title={t("motion")}>
          <Button variant="secondary" aria-pressed={moved} onClick={() => setMoved(!moved)}>
            {t("motionPlay")}
          </Button>
          <ul className="mt-6 flex max-w-xl flex-col gap-4">
            {MOTION.map(([id, className, label]) => (
              <li key={id} className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-x-3 text-body-s">
                  <span className="font-semibold">--dur-{id}</span>
                  <TokenValue name={`--dur-${id}`} />
                  <TokenValue name={`--ease-${id}`} />
                  <span className="text-text-2">{t(label)}</span>
                </div>
                <div className="relative h-6 rounded-full bg-surface-2">
                  <span
                    aria-hidden
                    className={`absolute top-1 size-4 rounded-full bg-text-1 transition-[inset-inline-start] ${className}`}
                    style={{ insetInlineStart: moved ? "calc(100% - 1.25rem)" : "0.25rem" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="stage" title={t("stage")}>
          <div className="stage relative max-w-3xl overflow-hidden rounded-sm bg-stage">
            {/* biome-ignore lint/performance/noImgElement: a static brand image stands in for artwork */}
            <img src="/brand/og.png" alt="" className="aspect-video w-full object-cover" />
            <div className="absolute inset-0" style={{ backgroundImage: "var(--scrim-bottom)" }} />
            <div
              className="absolute inset-0 flex flex-col justify-end gap-2 p-6"
              style={{ backgroundImage: "var(--scrim-start)" }}
            >
              <p className="text-h3">{t("stageTitle")}</p>
              <p className="max-w-xs text-body-s text-text-2">{t("stageText")}</p>
            </div>
          </div>
        </Section>
        <ControlsSections />
        <LayersSections />
      </main>
    </div>
  );
}
