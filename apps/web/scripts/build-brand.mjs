#!/usr/bin/env node
// All deliverables use the same manually redrawn paths as the React wordmark.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import {
  BRAND_INK,
  BRAND_LIME,
  LOGO_HEIGHT,
  LOGO_WIDTH,
  MARK_PATHS,
  WORDMARK_PATH,
} from "../src/lib/brand.ts";

const root = resolve(import.meta.dirname, "..");
const white = "#f5f6f8";
if ([...MARK_PATHS, WORDMARK_PATH].some((path) => /NaN|Infinity/.test(path))) {
  throw new Error("Brand geometry contains invalid coordinates.");
}
const mark = (fill = BRAND_LIME, compact = false) => {
  // Widen the separation to keep the two pieces distinct at 16 px.
  const paths = compact
    ? [
        "M4 39C4 33 8 30 13.5 32.3L25.4 39.1C29 40.6 30 43 30 47V84C30 88 28.8 90.4 25.4 91.9L13.5 98.7C8 101 4 98 4 92Z",
        MARK_PATHS[1],
      ]
    : MARK_PATHS;
  return `<g fill="${fill}">${paths.map((d) => `<path d="${d}"/>`).join("")}</g>`;
};
const logo = (ink = white, accent = BRAND_LIME) =>
  `<g transform="scale(.875)">${mark(accent)}</g><path fill="${ink}" d="${WORDMARK_PATH}"/>`;
const svg = (width, height, body, label = "Lumovio") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>\n`;
function save(file, data) {
  const path = resolve(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}
function png(source, width) {
  return new Resvg(source, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: false } })
    .render()
    .asPng();
}
const tile = (size, coverage, rounded = false, compact = false) => {
  const inset = (128 - 128 * coverage) / 2;
  return svg(
    size,
    size,
    `<g transform="scale(${size / 128})"><rect width="128" height="128" rx="${rounded ? 25 : 0}" fill="${BRAND_INK}"/><g transform="translate(${inset} ${inset}) scale(${coverage})">${mark(BRAND_LIME, compact)}</g></g>`,
  );
};

for (const [name, ink, accent] of [
  ["logo-dark", white, BRAND_LIME],
  ["logo-light", BRAND_INK, BRAND_INK],
  ["logo-black", "#000000", "#000000"],
  ["logo-white", "#ffffff", "#ffffff"],
]) {
  const source = svg(LOGO_WIDTH, LOGO_HEIGHT, logo(ink, accent));
  save(`public/brand/${name}.svg`, source);
  save(`public/brand/${name}.png`, png(source, LOGO_WIDTH * 3));
}
for (const [name, fill] of [
  ["mark", BRAND_LIME],
  ["mark-black", "#000000"],
  ["mark-white", "#ffffff"],
]) {
  const source = svg(128, 128, mark(fill));
  save(`public/brand/${name}.svg`, source);
  save(`public/brand/${name}.png`, png(source, 1024));
}
for (const size of [192, 512]) save(`public/brand/icon-${size}.png`, png(tile(size, 0.74), size));
// The complete symbol fits inside the maskable icon's central 80%-diameter safe circle.
save("public/brand/icon-maskable-512.png", png(tile(512, 0.54), 512));
save("src/app/apple-icon.png", png(tile(180, 0.68), 180));
save("src/app/icon.svg", tile(128, 0.84, true, true));

// A multi-resolution ICO containing PNG frames (16, 32 and 48 px).
const sizes = [16, 32, 48];
const frames = sizes.map((size) => png(tile(size, 0.84, true, size === 16), size));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (const [i, frame] of frames.entries()) {
  const entry = 6 + i * 16;
  directory[entry] = sizes[i];
  directory[entry + 1] = sizes[i];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
save("src/app/favicon.ico", Buffer.concat([directory, ...frames]));

const ogScale = 820 / LOGO_WIDTH;
save(
  "public/brand/og.png",
  png(
    svg(
      1200,
      630,
      `<rect width="1200" height="630" fill="${BRAND_INK}"/><g transform="translate(190 ${315 - (LOGO_HEIGHT * ogScale) / 2}) scale(${ogScale})">${logo()}</g>`,
    ),
    1200,
  ),
);

// Review sheet: logos use paths; only editorial labels use a system font.
const label = (x, y, text, fill = "#93969f", size = 15) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="Segoe UI,Arial,sans-serif" font-size="${size}" letter-spacing="2">${text}</text>`;
const placeLogo = (x, y, width, ink, accent) =>
  `<g transform="translate(${x} ${y}) scale(${width / LOGO_WIDTH})">${logo(ink, accent)}</g>`;
const sheet = svg(
  1600,
  1080,
  `
  <rect width="1600" height="1080" fill="${BRAND_INK}"/>
  ${label(64, 68, "LUMOVIO / 01 — LIGHT", white, 18)}
  ${label(1120, 68, "IDENTITY / OCT 2026")}
  <rect x="64" y="120" width="716" height="340" rx="20" fill="#15171b"/>
  <rect x="804" y="120" width="732" height="340" rx="20" fill="#f6f7f9"/>
  ${label(96, 163, "DARK")}${label(836, 163, "LIGHT", "#727680")}
  ${placeLogo(114, 245, 616, white, BRAND_LIME)}
  ${placeLogo(854, 245, 632, BRAND_INK, BRAND_INK)}
  <rect x="64" y="484" width="716" height="252" rx="20" fill="#15171b"/>
  <rect x="804" y="484" width="732" height="252" rx="20" fill="#ffffff"/>
  ${label(96, 527, "MONO / WHITE")}${label(836, 527, "MONO / BLACK", "#727680")}
  ${placeLogo(154, 578, 536, "#ffffff", "#ffffff")}
  ${placeLogo(894, 578, 552, "#000000", "#000000")}
  ${label(64, 802, "SYMBOL")}
  <g transform="translate(64 848) scale(1.1)">${mark()}</g>
  ${label(350, 802, "APP ICON")}
  <g transform="translate(350 844)"><rect width="144" height="144" rx="30" fill="#202329"/><g transform="translate(24 24) scale(.75)">${mark()}</g></g>
  ${label(650, 802, "SMALL SIZES")}
  <g transform="translate(650 878) scale(.5)">${mark()}</g>
  <g transform="translate(756 894) scale(.25)">${mark()}</g>
  <g transform="translate(828 910) scale(.125)">${mark(BRAND_LIME, true)}</g>
  ${label(650, 988, "64 / 32 / 16 PX", "#93969f", 12)}
  ${label(1030, 802, "PALETTE")}
  <rect x="1030" y="850" width="236" height="96" rx="16" fill="${BRAND_LIME}"/>
  <rect x="1282" y="850" width="118" height="96" rx="16" fill="#f5f6f8"/>
  <rect x="1416" y="850" width="120" height="96" rx="16" fill="#15171b"/>
  ${label(1030, 988, "#DCFA63 / #0B0C10", "#93969f", 12)}
`,
);
save("brand/identity-sheet.svg", sheet);
save(
  "brand/identity-sheet.png",
  new Resvg(sheet, { fitTo: { mode: "width", value: 1600 } }).render().asPng(),
);
console.log("Built SVG/PNG logos, app icons, favicon, social image and identity sheet.");
