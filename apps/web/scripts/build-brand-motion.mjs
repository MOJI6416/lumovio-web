#!/usr/bin/env node
/** Reproducible silent motion kit, platform launch screens and the offline page's inline art. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  CHECK_PATH,
  INTRO_BEAM_PATH,
  LOADER_BEAM_PATH,
  MARK_PATHS,
  MOTION_ACTION_PATHS,
  WORDMARK_PATH,
} from "../src/lib/brand.ts";
import { buildLaunchAssets } from "./build-brand-launch.mjs";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "brand/motion");
const css = readFileSync(resolve(source, "motion.css"), "utf8");
const paths = MARK_PATHS.map((d, i) => `<path class="${i ? "lm-screen" : "lm-projector"}" d="${d}"/>`).join(
  "",
);
const style = `<style>${css}</style>`;
const svg = (classes, viewBox, width, height, content, light = false, label = "Lumovio") =>
  `<svg xmlns="http://www.w3.org/2000/svg" class="lm-art ${classes}" width="${width}" height="${height}" viewBox="${viewBox}" role="img" aria-label="${label}"${light ? ' data-theme="light"' : ""}><title>${label}</title>${style}${content}</svg>`;

function splash(id) {
  return svg(
    "lm-splash",
    "-96 -90 683 292",
    683,
    292,
    `
    <defs>
      <clipPath id="${id}-reveal"><rect class="lm-word-reveal" x="130" y="0" width="365" height="112"/></clipPath>
      <linearGradient id="${id}-light"><stop stop-color="var(--lm-mark)" stop-opacity=".7"/><stop offset="1" stop-color="var(--lm-mark)" stop-opacity="0"/></linearGradient>
    </defs>
    <g class="lm-mark-move">
      <path class="lm-light" d="${INTRO_BEAM_PATH}" fill="url(#${id}-light)"/>
      <g class="lm-mark" transform="scale(.875)">${paths}</g>
    </g>
    <g clip-path="url(#${id}-reveal)"><path class="lm-type" d="${WORDMARK_PATH}"/></g>`,
  );
}
const compact = () => svg("lm-compact", "-32 -32 192 192", 192, 192, `<g class="lm-mark">${paths}</g>`);
const loader = (light = false) =>
  svg(
    "lm-loader",
    "0 0 128 128",
    64,
    64,
    `<g class="lm-mark">${paths}</g><path class="lm-beam" d="${LOADER_BEAM_PATH}"/>`,
    light,
  );
const saved = (light = false) =>
  svg(
    "lm-saved",
    "0 0 64 64",
    64,
    64,
    `<circle class="lm-check-ring" cx="32" cy="32" r="27" fill="currentColor" fill-opacity=".12"/>
   <path class="lm-check" d="${CHECK_PATH}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>`,
    light,
    "Saved",
  );
const action = (name, light = false) =>
  svg(
    `lm-action lm-${name}`,
    "0 0 24 24",
    64,
    64,
    `<g class="lm-action-glyph"><path class="lm-action-fill" d="${MOTION_ACTION_PATHS[name][0]}" fill="currentColor"/>
  ${MOTION_ACTION_PATHS[name].map((d) => `<path class="lm-action-outline" d="${d}" pathLength="1" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</g>`,
    light,
    name,
  );
const offline = (light = false) =>
  svg(
    "lm-offline",
    "0 0 128 128",
    64,
    64,
    `<g>${paths}</g><path class="lm-beam" d="${LOADER_BEAM_PATH}"/>`,
    light,
    "Offline",
  );
function save(file, content) {
  const path = resolve(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
const assets = {
  "intro.svg": splash("lumovio-intro"),
  "intro-compact.svg": compact(),
  "loader.svg": loader(),
  "loader-light.svg": loader(true),
  "saved.svg": saved(),
  "saved-light.svg": saved(true),
};
for (const name of Object.keys(MOTION_ACTION_PATHS)) {
  assets[`${name}.svg`] = action(name);
  assets[`${name}-light.svg`] = action(name, true);
}
assets["offline.svg"] = offline();
assets["offline-light.svg"] = offline(true);
for (const [name, content] of Object.entries(assets)) save(`public/brand/motion/${name}`, `${content}\n`);
// Browsers do not consistently pass reduced-motion preferences into SVG image documents.
// A <picture> source uses these matching posters, without relying on image-document media queries.
for (const [name, content] of Object.entries(assets)) {
  const still = content.replace("</style>", "\n.lm-art * { animation: none !important; }\n</style>");
  save(`public/brand/motion/${name.replace(".svg", "-still.svg")}`, `${still}\n`);
}

const launch = buildLaunchAssets();
// Inline offline art: no resource fetch while disconnected; preserve the worker's auth bridge and texts.
const workerPath = resolve(root, "public/sw.js");
let worker = readFileSync(workerPath, "utf8");
const offlineCSS = css
  .split("/* offline:start")[1]
  ?.split("*/")
  .slice(1)
  .join("*/")
  .split("/* offline:end */")[0];
if (!offlineCSS) throw new Error("Missing offline CSS boundaries");
const offlineArt = offline()
  .replace(
    /<style>[\s\S]*?<\/style>/,
    () =>
      `<style>${offlineCSS}\n@media(prefers-reduced-motion:reduce){.lm-offline *{animation:none!important}}</style>`,
  )
  .replace(
    'role="img" aria-label="Offline"',
    'aria-hidden="true" style="--lm-mark:var(--mark);--lm-muted:var(--text2)"',
  );
const block = `/* BEGIN brand:motion offline */\nconst OFFLINE_MOTION_ART = ${JSON.stringify(offlineArt)};\n/* END brand:motion offline */`;
if (!worker.includes("/* BEGIN brand:motion offline */"))
  throw new Error("Missing offline artwork marker in sw.js");
worker = worker.replace(
  /\/\* BEGIN brand:motion offline \*\/[\s\S]*?\/\* END brand:motion offline \*\//,
  () => block,
);
writeFileSync(workerPath, worker);
// The review is also self-contained: one document, no servers, requests, audio or fonts required.
const templates = Object.entries({
  intro: splash("lumovio-preview"),
  compact: compact(),
  loader: loader(),
  saved: saved(),
  favourite: action("favourite"),
  like: action("like"),
  rating: action("rating"),
  offline: offline(),
  android: compact(),
  iphone: launch.iphone.replace("<svg ", '<svg class="lm-device-preview" '),
  ipad: launch.ipad.replace("<svg ", '<svg class="lm-device-preview" '),
})
  .map(([name, content]) => `<template data-asset="${name}">${content}</template>`)
  .join("\n");
let fragment = readFileSync(resolve(source, "preview.fragment.html"), "utf8");
fragment = fragment.replace("<!-- MOTION_TEMPLATES -->", templates);
save(
  "brand/motion/preview.html",
  `<!doctype html>\n<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumovio — Light motion</title><style>body{margin:0;background:#0b0c10;padding:24px}body:has([data-review-theme="light"]){background:#f6f7f9}</style></head><body>${fragment}</body></html>\n`,
);
if (process.argv.includes("--inline-out")) {
  const target = process.argv[process.argv.indexOf("--inline-out") + 1];
  if (!target) throw new Error("--inline-out requires an absolute HTML path");
  mkdirSync(dirname(resolve(target)), { recursive: true });
  writeFileSync(resolve(target), fragment);
}
console.log(`Built ${Object.keys(assets).length} motion SVGs, matching static SVGs and the offline preview.`);
