import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";

/** One of public/codecs/'s WebAssembly modules, loaded in Node as a worker's importScripts() would see it. */
export type CodecModule = {
  cwrap: (name: string, ret: string | null, args: string[]) => (...a: number[]) => number;
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
  _malloc: (n: number) => number;
  _free: (p: number) => void;
};

export function loadCodec(name: "audio" | "video"): () => Promise<CodecModule> {
  // public/ is ESM for Node, so the script (an Emscripten UMD) runs in a function scope of its own.
  const script = new URL(`../public/codecs/${name}.js`, import.meta.url);
  const holder = { exports: {} as { default?: (o: object) => Promise<CodecModule> } };
  const nl = String.fromCharCode(10);
  const wrapped = runInThisContext(
    `(function (module, exports, require, __filename, __dirname) {${readFileSync(script, "utf8")}${nl}})`,
  ) as (...a: unknown[]) => void;
  wrapped(
    holder,
    holder.exports,
    createRequire(script),
    fileURLToPath(script),
    fileURLToPath(new URL(".", script)),
  );
  return () => holder.exports.default!({});
}
