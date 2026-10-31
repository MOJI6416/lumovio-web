// JASSUB (libass in WebAssembly; MIT, with LGPL/FTL/ISC parts — see public/codecs/jassub/LICENSE.txt) as static files
// of public/codecs/jassub/: its page module and its worker bundled with esbuild, its .wasm and default font copied.
// The player loads it from there by URL (lib/media/subs/engine.ts), never through Next's bundler: JASSUB's Emscripten
// worker starts copies of itself (new Worker(new URL(self))), which keeps Turbopack's production build from finishing.
// Run after changing the jassub version: node scripts/player-codecs/jassub.mjs (the output is committed).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../apps/web/", import.meta.url));
const require = createRequire(join(root, "package.json"));
const esbuild = require("esbuild");
const pkg = dirname(require.resolve("jassub/package.json"));
const out = join(root, "public/codecs/jassub");
mkdirSync(join(out, "worker"), { recursive: true });
mkdirSync(join(out, "wasm"), { recursive: true });
const version = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version;
const banner = {
  js: `/* JASSUB ${version} (https://github.com/ThaUnknown/jassub), bundled by scripts/player-codecs/jassub.mjs */`,
};
for (const [entry, file] of [
  ["dist/jassub.js", "jassub.js"],
  ["dist/worker/worker.js", "worker/worker.js"],
]) {
  await esbuild.build({
    entryPoints: [join(pkg, entry)],
    outfile: join(out, file),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "eof",
    banner,
    logLevel: "warning",
  });
}
for (const f of ["wasm/jassub-worker.wasm", "wasm/jassub-worker-modern.wasm", "default.woff2"])
  copyFileSync(join(pkg, "dist", f), join(out, f));
writeFileSync(
  join(out, "LICENSE.txt"),
  `JASSUB ${version} — ${JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).license}\n\n${readFileSync(join(pkg, "LICENSE"), "utf8")}`,
);
console.log("jassub", version, "→ public/codecs/jassub");
